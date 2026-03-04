#!/usr/bin/env python3
"""Extract SKU cards from Chehovskiy sections, download images and build contact sheets."""

from __future__ import annotations

import argparse
import csv
import html
import json
import math
import re
import statistics
import urllib.parse
import urllib.request
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont, ImageStat

SECTIONS = {
    "furshetmenu": "https://363363.ru/furshetmenu",
    "hot": "https://363363.ru/hot",
    "zakuski": "https://363363.ru/zakuski",
    "desert": "https://363363.ru/desert",
    "napitki": "https://363363.ru/napitki",
}

CARD_SPLIT_RE = re.compile(r'<div class="Button item_name[^>]*>', re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


@dataclass
class SKUCard:
    section: str
    sku_idx: int
    sku_id: str
    source_url: str
    add_button_id: str
    name: str
    description: str
    weight_text: str
    price_rub: float | None
    image_url: str
    image_path: str
    image_width: int
    image_height: int
    img_brightness: float
    img_contrast: float
    img_saturation: float
    img_warmth: float
    img_sharpness: float
    image_quality_score: float
    food_styling_score: float
    appetite_score_data: float


class AppError(Exception):
    pass


def strip_tags(raw: str) -> str:
    text = TAG_RE.sub(" ", raw)
    text = html.unescape(text)
    return WS_RE.sub(" ", text).strip()


def fetch_text(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        return resp.read().decode("utf-8", errors="ignore")


def fetch_binary(url: str, timeout: int = 10) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        return resp.read()


def resolve_url(base: str, maybe_rel: str) -> str:
    return urllib.parse.urljoin(base, maybe_rel)


def parse_price(text: str) -> float | None:
    m = re.search(r"(\d[\d\s]*)(?:[\.,](\d+))?", text)
    if not m:
        return None
    int_part = m.group(1).replace(" ", "")
    frac = m.group(2) or ""
    value = f"{int_part}.{frac}" if frac else int_part
    try:
        return float(value)
    except ValueError:
        return None


def choose_description(block: str) -> str:
    cands = re.findall(r"<h2[^>]*>(.*?)</h2>", block, flags=re.IGNORECASE | re.DOTALL)
    cleaned = []
    for c in cands:
        t = strip_tags(c)
        if not t:
            continue
        low = t.lower()
        if "цена" in low or "вес" in low or "ккал" in low:
            continue
        if len(t) < 8:
            continue
        cleaned.append(t)
    if not cleaned:
        return ""
    return sorted(cleaned, key=len, reverse=True)[0]


def choose_weight(block: str) -> str:
    m = re.search(r"(Вес\s*:[^<]{0,40})", block, flags=re.IGNORECASE)
    if m:
        return strip_tags(m.group(1))
    cands = re.findall(r"<h2[^>]*>(.*?)</h2>", block, flags=re.IGNORECASE | re.DOTALL)
    for c in cands:
        t = strip_tags(c)
        if "вес" in t.lower():
            return t
    return ""


def choose_image(block: str, base_url: str) -> str:
    img_tags = re.findall(r"<img[^>]+>", block, flags=re.IGNORECASE)
    for tag in img_tags:
        data_src = re.search(r'data-muse-src="([^"]+)"', tag)
        src_m = re.search(r'src="([^"]+)"', tag)
        src = (data_src.group(1) if data_src else (src_m.group(1) if src_m else "")).strip()
        if not src:
            continue
        low = src.lower()
        if ".svg" in low:
            continue
        if "poster_" in low:
            continue
        if not any(ext in low for ext in (".jpg", ".jpeg", ".png", ".webp")):
            continue
        return resolve_url(base_url, src)
    return ""


def normalize_score(value: float, low: float, high: float) -> float:
    if high <= low:
        return 5.0
    x = (value - low) / (high - low)
    x = max(0.0, min(1.0, x))
    return round(1 + x * 9, 2)


def analyze_image(path: Path) -> dict[str, float | int]:
    with Image.open(path) as im:
        rgb = im.convert("RGB")
        w, h = rgb.size
        stat = ImageStat.Stat(rgb)
        mean_r, mean_g, mean_b = stat.mean

        gray = rgb.convert("L")
        gray_stat = ImageStat.Stat(gray)
        brightness = float(gray_stat.mean[0])
        contrast = float(gray_stat.stddev[0])

        hsv = rgb.convert("HSV")
        s_channel = hsv.split()[1]
        sat = float(ImageStat.Stat(s_channel).mean[0])

        warmth = float((mean_r + 1) / (mean_b + 1))

        edges = gray.filter(ImageFilter.FIND_EDGES)  # type: ignore[name-defined]
        sharpness = float(ImageStat.Stat(edges).stddev[0])

    return {
        "image_width": int(w),
        "image_height": int(h),
        "img_brightness": round(brightness, 2),
        "img_contrast": round(contrast, 2),
        "img_saturation": round(sat, 2),
        "img_warmth": round(warmth, 3),
        "img_sharpness": round(sharpness, 2),
    }


def extract_cards(section: str, url: str, html_text: str) -> list[dict[str, str | float | None]]:
    parts = CARD_SPLIT_RE.split(html_text)
    cards: list[dict[str, str | float | None]] = []
    for idx, part in enumerate(parts[1:], start=1):
        if "add_to_cart" not in part:
            continue

        # Isolate one card region up to add_to_cart block end.
        cut = re.search(r"<div class=\"Button add_to_cart[^>]*>.*?</div>", part, flags=re.IGNORECASE | re.DOTALL)
        block = part[: cut.end()] if cut else part

        name_m = re.search(
            r"<div class=\"itemn_name[^>]*>(.*?)</div>",
            block,
            flags=re.IGNORECASE | re.DOTALL,
        )
        price_m = re.search(
            r"<div class=\"itemn_price[^>]*>(.*?)</div>",
            block,
            flags=re.IGNORECASE | re.DOTALL,
        )
        add_btn_m = re.search(r"<div class=\"Button add_to_cart[^\"]*\" id=\"([^\"]+)\"", block, flags=re.IGNORECASE)

        name = strip_tags(name_m.group(1)) if name_m else ""
        price_text = strip_tags(price_m.group(1)) if price_m else ""
        price_rub = parse_price(price_text)
        image_url = choose_image(block, url)
        description = choose_description(block)
        weight_text = choose_weight(block)
        add_id = add_btn_m.group(1) if add_btn_m else ""

        if not name and not image_url:
            continue

        cards.append(
            {
                "section": section,
                "sku_idx": idx,
                "sku_id": f"{section}-{idx:03d}",
                "source_url": url,
                "add_button_id": add_id,
                "name": name,
                "description": description,
                "weight_text": weight_text,
                "price_rub": price_rub,
                "image_url": image_url,
            }
        )

    return cards


def save_image(url: str, target: Path) -> bool:
    if not url:
        return False
    if target.exists() and target.stat().st_size > 0:
        return True
    try:
        data = fetch_binary(url)
    except Exception:
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return True


def image_ext(url: str, default: str = ".jpg") -> str:
    path = urllib.parse.urlparse(url).path.lower()
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        if path.endswith(ext):
            return ext
    return default


def build_contact_sheet(section: str, cards: list[SKUCard], out_path: Path, cols: int = 5) -> None:
    thumb_w, thumb_h = 260, 180
    label_h = 60
    pad = 16

    rows = math.ceil(len(cards) / cols)
    canvas_w = pad + cols * (thumb_w + pad)
    canvas_h = pad + rows * (thumb_h + label_h + pad)

    canvas = Image.new("RGB", (canvas_w, canvas_h), (245, 245, 245))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()

    for i, card in enumerate(cards):
        r = i // cols
        c = i % cols
        x = pad + c * (thumb_w + pad)
        y = pad + r * (thumb_h + label_h + pad)

        if card.image_path and Path(card.image_path).exists():
            try:
                with Image.open(card.image_path) as im:
                    im = im.convert("RGB")
                    im.thumbnail((thumb_w, thumb_h))
                    bg = Image.new("RGB", (thumb_w, thumb_h), (230, 230, 230))
                    bx = (thumb_w - im.width) // 2
                    by = (thumb_h - im.height) // 2
                    bg.paste(im, (bx, by))
                    canvas.paste(bg, (x, y))
            except Exception:
                draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=(180, 0, 0), width=2)
        else:
            draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=(180, 0, 0), width=2)

        title = f"{card.sku_id} | {card.name[:38]}"
        price = f"{int(card.price_rub)} RUB" if card.price_rub is not None else "no price"
        score = f"taste_data={card.appetite_score_data}"
        draw.text((x, y + thumb_h + 4), title, fill=(30, 30, 30), font=font)
        draw.text((x, y + thumb_h + 22), f"{price} | {score}", fill=(45, 45, 45), font=font)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default="artifacts/sku-audit")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    html_dir = out_dir / "html"
    img_dir = out_dir / "images"
    sheet_dir = out_dir / "contact-sheets"
    out_dir.mkdir(parents=True, exist_ok=True)

    raw_cards: list[dict[str, str | float | None]] = []
    for section, url in SECTIONS.items():
        html_text = fetch_text(url)
        html_dir.mkdir(parents=True, exist_ok=True)
        (html_dir / f"{section}.html").write_text(html_text, encoding="utf-8")
        raw_cards.extend(extract_cards(section, url, html_text))

    # Download and image-analysis pass
    analyzed_rows: list[SKUCard] = []
    for row in raw_cards:
        sec = str(row["section"])
        sku_id = str(row["sku_id"])
        image_url = str(row.get("image_url") or "")
        ext = image_ext(image_url)
        local = img_dir / sec / f"{sku_id}{ext}"

        ok = save_image(image_url, local) if image_url else False
        img_stats = {
            "image_width": 0,
            "image_height": 0,
            "img_brightness": 0.0,
            "img_contrast": 0.0,
            "img_saturation": 0.0,
            "img_warmth": 0.0,
            "img_sharpness": 0.0,
        }
        if ok:
            try:
                img_stats = analyze_image(local)
            except Exception:
                pass

        analyzed_rows.append(
            SKUCard(
                section=sec,
                sku_idx=int(row["sku_idx"]),
                sku_id=sku_id,
                source_url=str(row["source_url"]),
                add_button_id=str(row.get("add_button_id") or ""),
                name=str(row.get("name") or ""),
                description=str(row.get("description") or ""),
                weight_text=str(row.get("weight_text") or ""),
                price_rub=float(row["price_rub"]) if row.get("price_rub") is not None else None,
                image_url=image_url,
                image_path=str(local) if ok else "",
                image_width=int(img_stats["image_width"]),
                image_height=int(img_stats["image_height"]),
                img_brightness=float(img_stats["img_brightness"]),
                img_contrast=float(img_stats["img_contrast"]),
                img_saturation=float(img_stats["img_saturation"]),
                img_warmth=float(img_stats["img_warmth"]),
                img_sharpness=float(img_stats["img_sharpness"]),
                image_quality_score=0.0,
                food_styling_score=0.0,
                appetite_score_data=0.0,
            )
        )

    # Normalize image-based scores globally.
    brightness_vals = [x.img_brightness for x in analyzed_rows if x.img_brightness > 0]
    contrast_vals = [x.img_contrast for x in analyzed_rows if x.img_contrast > 0]
    sat_vals = [x.img_saturation for x in analyzed_rows if x.img_saturation > 0]
    warm_vals = [x.img_warmth for x in analyzed_rows if x.img_warmth > 0]
    sharp_vals = [x.img_sharpness for x in analyzed_rows if x.img_sharpness > 0]

    if not (brightness_vals and contrast_vals and sat_vals and warm_vals and sharp_vals):
        # Keep artifact generation deterministic even if remote image fetch fails.
        brightness_vals = brightness_vals or [0.0, 1.0]
        contrast_vals = contrast_vals or [0.0, 1.0]
        sat_vals = sat_vals or [0.0, 1.0]
        warm_vals = warm_vals or [0.0, 1.0]
        sharp_vals = sharp_vals or [0.0, 1.0]

    for row in analyzed_rows:
        b = normalize_score(row.img_brightness, min(brightness_vals), max(brightness_vals))
        c = normalize_score(row.img_contrast, min(contrast_vals), max(contrast_vals))
        s = normalize_score(row.img_saturation, min(sat_vals), max(sat_vals))
        w = normalize_score(row.img_warmth, min(warm_vals), max(warm_vals))
        sh = normalize_score(row.img_sharpness, min(sharp_vals), max(sharp_vals))

        row.image_quality_score = round((0.45 * sh + 0.35 * c + 0.20 * b), 2)
        row.food_styling_score = round((0.50 * s + 0.30 * w + 0.20 * b), 2)
        row.appetite_score_data = round((0.55 * row.image_quality_score + 0.45 * row.food_styling_score), 2)

    # Save CSV/JSON
    csv_path = out_dir / "sku_cards.csv"
    json_path = out_dir / "sku_cards.json"
    fieldnames = list(asdict(analyzed_rows[0]).keys())

    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in analyzed_rows:
            writer.writerow(asdict(row))

    with json_path.open("w", encoding="utf-8") as f:
        json.dump([asdict(r) for r in analyzed_rows], f, ensure_ascii=False, indent=2)

    # Section summary
    section_summary = []
    for sec in SECTIONS:
        rows = [r for r in analyzed_rows if r.section == sec]
        prices = [r.price_rub for r in rows if r.price_rub is not None]
        section_summary.append(
            {
                "section": sec,
                "sku_count": len(rows),
                "price_min": min(prices) if prices else None,
                "price_median": statistics.median(prices) if prices else None,
                "price_max": max(prices) if prices else None,
                "appetite_score_avg": round(sum(r.appetite_score_data for r in rows) / len(rows), 2) if rows else None,
                "appetite_score_p25": round(statistics.quantiles([r.appetite_score_data for r in rows], n=4)[0], 2) if len(rows) >= 4 else None,
                "appetite_score_p75": round(statistics.quantiles([r.appetite_score_data for r in rows], n=4)[2], 2) if len(rows) >= 4 else None,
            }
        )

    (out_dir / "section_summary.json").write_text(json.dumps(section_summary, ensure_ascii=False, indent=2), encoding="utf-8")

    # Contact sheets per section for manual visual review in Codex UI.
    for sec in SECTIONS:
        rows = [r for r in analyzed_rows if r.section == sec]
        build_contact_sheet(sec, rows, sheet_dir / f"{sec}.png")

    print(f"saved: {csv_path}")
    print(f"saved: {json_path}")
    print(f"saved: {out_dir / 'section_summary.json'}")
    print(f"saved sheets: {sheet_dir}")


if __name__ == "__main__":
    # Late import to keep top-level minimal and explicit.
    from PIL import ImageFilter

    main()
