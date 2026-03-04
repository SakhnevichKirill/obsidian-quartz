# SKU HADI-аудит (фокус: add_to_cart и отправка заказа)

Дата: 2026-03-04  
Объект: разделы меню `furshetmenu`, `hot`, `zakuski`, `desert`, `napitki`  
Счетчик: `44565499` (Yandex Metrika, `accuracy=full`)

## 1) Корректировка модели воронки

Да, замечание верное: для этой структуры сайта первичный коммерческий шаг не звонок, а корзина.

Корректный путь:

1. Пользователь выбирает SKU.
2. Нажимает `Добавить`.
3. Переходит к корзине.
4. Отправляет заказ формой.
5. Дальше происходит обратный контакт/звонок.

Предыдущий акцент на phone-click как главном KPI для SKU был некорректен.

## 2) Что подтверждено данными (факты)

### 2.1 По разделам (история 2017-05-09..2026-03-04)

| Раздел | SKU | Визиты | Users | Bounce | `checkout_begin` | Формы | Phone-click | CR формы |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `furshetmenu` | 23 | 2,181 | 1,132 | 16.55% | 0 | 17 | 10 | 0.78% |
| `hot` | 37 | 2,680 | 2,211 | 17.39% | 0 | 15 | 3 | 0.56% |
| `zakuski` | 35 | 5,744 | 4,307 | 12.22% | 0 | 25 | 7 | 0.44% |
| `desert` | 25 | 2,381 | 1,958 | 17.14% | 0 | 11 | 2 | 0.46% |
| `napitki` | 19 | 261 | 207 | 45.98% | 0 | 1 | 0 | 0.38% |

### 2.2 Последний рабочий год (2025-03-01..2026-03-04)

| Раздел | Визиты | Forms | Phone-click | `checkout_begin` | CR формы |
|---|---:|---:|---:|---:|---:|
| `furshetmenu` | 106 | 0 | 1 | 0 | 0.00% |
| `hot` | 57 | 2 | 1 | 0 | 3.51% |
| `zakuski` | 202 | 1 | 1 | 0 | 0.50% |
| `desert` | 80 | 0 | 0 | 0 | 0.00% |
| `napitki` | 4 | 0 | 0 | 0 | 0.00% |

### 2.3 Ключевой диагностический факт по корзине

- По счетчику есть автоцель `513969012` («Начало оформления заказа»).
- По сайту в целом она сработала всего `1` раз за весь период.
- По всем 5 анализируемым разделам (`furshetmenu/hot/zakuski/desert/napitki`) — **0 срабатываний**.

Вывод: историческая аналитика по `add_to_cart`/`checkout` в SKU-срезе сейчас практически отсутствует.

## 3) Технический факт по трекингу корзины

- Корзина реализована через `assets/s_cart.js` (обфусцированный виджет).
- В коде не найден явный вызов `ym(... reachGoal('add_to_cart'...))`.
- E-commerce метрики API недоступны для счетчика (`ecommerce is not enabled for 44565499`).

Это означает, что `add_to_cart` как KPI сейчас не измеряется на уровне SKU.

## 4) Анализ всех SKU + критерий «вкусности карточки»

Полный SKU-реестр (139 карточек) выгружен и рассчитан по карточкам:

- `[sku_cards.csv](/Users/kirsr/workspace/cheh/artifacts/sku-audit/sku_cards.csv)`
- `[sku_taste_priority.csv](/Users/kirsr/workspace/cheh/artifacts/sku-audit/sku_taste_priority.csv)`

Визуальный прогон выполнен по всем изображениям через contact sheets:

- `[furshetmenu.png](/Users/kirsr/workspace/cheh/artifacts/sku-audit/contact-sheets/furshetmenu.png)`
- `[hot.png](/Users/kirsr/workspace/cheh/artifacts/sku-audit/contact-sheets/hot.png)`
- `[zakuski.png](/Users/kirsr/workspace/cheh/artifacts/sku-audit/contact-sheets/zakuski.png)`
- `[desert.png](/Users/kirsr/workspace/cheh/artifacts/sku-audit/contact-sheets/desert.png)`
- `[napitki.png](/Users/kirsr/workspace/cheh/artifacts/sku-audit/contact-sheets/napitki.png)`

### Критерии «вкусности карточки» (в таблице)

- `image_quality_score` (фокус/контраст/читаемость блюда)
- `food_styling_score` (цвет, тепловая/аппетитная подача)
- `appetite_score_data` (интегральный скор 1..10)

Сводка по «вкусности»:

| Раздел | Avg `appetite_score_data` | low | mid | high |
|---|---:|---:|---:|---:|
| `furshetmenu` | 5.77 | 4 | 12 | 7 |
| `hot` | 6.17 | 4 | 22 | 11 |
| `zakuski` | 6.00 | 0 | 27 | 8 |
| `desert` | 5.39 | 8 | 12 | 5 |
| `napitki` | 5.50 | 2 | 15 | 2 |

Доп. факт по контенту карточек:

- `napitki`: 13 из 19 SKU без цены.
- Найдены дубли изображений и placeholder-карточки (особенно `desert`, точечно `furshetmenu`).

## 5) HADI-гипотезы (SMART) для SKU-воронки

### HADI-1: Измеримость add_to_cart на уровне SKU

- Диагноз: по SKU нет исторических измерений `add_to_cart`, `checkout_begin` по разделам = 0.
- Гипотеза (SMART): если внедрить события `add_to_cart` с `sku_id`, `section`, `price`, то за 14 дней получим >=95% событий от фактических кликов кнопки `Добавить`.
- Механика реализации:
  1. В `s_cart.js` добавить `ym(44565499,'reachGoal','add_to_cart',{sku_id,section,price})`.
  2. Добавить событие `cart_open` и `order_submit`.
  3. Вынести `sku_id` в `data-*` атрибут каждой карточки.
- Критерий успеха:
  - в Метрике появляются ненулевые события по каждому разделу;
  - расхождение «клики UI vs события Метрики» <= 5%.

### HADI-2: Поднять CR корзины в `zakuski` (самый высокий спрос)

- Диагноз: `zakuski` = максимальный трафик (5,744 визита), но CR формы 0.44%.
- Гипотеза (SMART): после внедрения трекинга и правки карточек увеличить `add_to_cart CR` раздела `zakuski` до >=6% за 30 дней, `order_submit CR` до >=1.2%.
- Механика реализации:
  1. На карточках `zakuski` добавить “быстрые наборы” и “хит” бейджи.
  2. Закрепить видимость корзины (sticky mini-cart).
  3. Упростить форму заказа до 2 полей + комментарий.
- Критерий успеха:
  - `add_to_cart CR >= 6%`;
  - `order_submit CR >= 1.2%`;
  - bounce не растет более чем на 3 п.п.

### HADI-3: Фотопересъемка low-SKU в `desert` и `furshetmenu`

- Диагноз: низкая «вкусность» у части карточек (`desert low=8`, `furshetmenu low=4`), видны placeholder/слабые фото.
- Гипотеза (SMART): замена low-фото на аппетитные (единый фон, свет, крупный план) повысит `add_to_cart CR` этих SKU-групп на >=25% за 21 день.
- Механика реализации:
  1. Приоритетная пересъемка 12 low-SKU: 
     `furshetmenu-017/019/020/023`, `desert-006/018/019/021/022/023/024/025`.
  2. Единый стандарт кадра: 4:3, блюдо >=70% кадра, теплый свет, без шумного фона.
  3. A/B по фото (старое vs новое) на 2 недели.
- Критерий успеха:
  - рост `add_to_cart CR` low-SKU >= 25%;
  - рост `order_submit CR` раздела >= 10%.

### HADI-4: Цены и упаковка в `napitki`

- Диагноз: `napitki` имеет высокий bounce (45.98%), 13/19 SKU без цены.
- Гипотеза (SMART): заполнение цен + продажа только в связке с едой уменьшит bounce до <=35% и даст `add_to_cart CR` >=3% за 30 дней.
- Механика реализации:
  1. Проставить цену всем SKU напитков.
  2. Добавить режим “добавить напиток к набору”, убрать standalone-фокус.
  3. В карточке напитка показывать «рекомендуем к SKU X».
- Критерий успеха:
  - bounce `napitki` <= 35%;
  - `add_to_cart CR` раздела >= 3%.

### HADI-5: Согласование desktop/mobile сценария в `hot`

- Диагноз: в `hot` мобильные пути конвертят в формы заметно лучше desktop (`/phone/hot` forms CR 4.38% vs `/hot.html` 0.28%).
- Гипотеза (SMART): перенос mobile-паттернов (видимость CTA, компактность карточки, быстрый доступ к корзине) повысит desktop `order_submit CR` до >=0.9% за 30 дней.
- Механика реализации:
  1. Сделать на desktop ту же иерархию CTA, что на mobile.
  2. Добавить фиксированную кнопку “Корзина” + счётчик SKU.
  3. Сократить визуальный шум карточки.
- Критерий успеха:
  - desktop `order_submit CR` `hot` >= 0.9%;
  - снижение bounce desktop минимум на 5 п.п.

## 6) Что уже подготовлено в проекте

Готовые артефакты для работы без повторного парсинга:

- `[section_kpi_summary.csv](/Users/kirsr/workspace/cheh/artifacts/sku-audit/section_kpi_summary.csv)`
- `[section_device_summary.csv](/Users/kirsr/workspace/cheh/artifacts/sku-audit/section_device_summary.csv)`
- `[section_top_paths.csv](/Users/kirsr/workspace/cheh/artifacts/sku-audit/section_top_paths.csv)`
- `[section_monthly_recent.csv](/Users/kirsr/workspace/cheh/artifacts/sku-audit/section_monthly_recent.csv)`
- `[metrika_sections.json](/Users/kirsr/workspace/cheh/artifacts/sku-audit/metrika_sections.json)`
- `[scripts/sku_parser_visual.py](/Users/kirsr/workspace/cheh/scripts/sku_parser_visual.py)`

