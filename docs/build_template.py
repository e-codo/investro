"""Собирает docs/template-report.xlsx (пустой шаблон) и docs/template-report-example.xlsx (образец по отчёту за сентябрь 2026).
Запуск: python3 docs/build_template.py  (нужен openpyxl)."""
import datetime as dt
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

HEAD = Font(bold=True, color="222222")
FILL = PatternFill("solid", fgColor="E9E5DD")
INPUT = PatternFill("solid", fgColor="FFF8E1")
thin = Side(style="thin", color="B3ADA1")
B = Border(top=thin, bottom=thin, left=thin, right=thin)
RUB = "#,##0.00"
DATE = "DD.MM.YYYY"

# поле, пример, формат, пояснение
REPORT = [
    ("Версия шаблона", 2, "0", "Не менять. Приложение принимает только известные версии."),
    ("Период с", dt.date(2026, 9, 1), DATE, "Из шапки: «За период …» (первая дата). Период должен быть одним календарным месяцем."),
    ("Период по", dt.date(2026, 9, 30), DATE, "Из шапки: «За период …» (вторая дата). Это дата снимка. «Дату отчёта» из шапки не переносить."),
    ("Стоимость портфеля, ₽", 36237.86, RUB, "Из шапки: «Стоимость»."),
    ("Деньги, ₽", 256.44, RUB, "Раздел «Деньги», строка «Рубль РФ», колонка «Сумма»."),
    ("Пополнения за период, ₽", 18000.00, RUB, "«Пополнения и выводы», строка «Рубль РФ», колонка «Пополнение». Без знака «+». Если «-», писать 0."),
    ("Выводы за период, ₽", 0, RUB, "Та же таблица, колонка «Вывод». Если «-», писать 0."),
    ("Выплаты на счёт в банке, ₽", 0, RUB, "Та же таблица, колонка «Выплаты на счёт в банке». Если «-», писать 0."),
    ("Комиссии, ₽", 26.30, RUB, "«Комиссии и налоги»: брокерская + биржевая + маржинальное кредитование + прочие услуги. Без знака «−»."),
    ("Налоги, ₽", 0, RUB, "«Комиссии и налоги», колонка «Налоги». Без знака «−». Если «-», писать 0."),
    ("Итого по облигациям, ₽", 21733.45, RUB, "Строка «Итого» в таблице «Облигации». Нет раздела — 0."),
    ("Итого по фондам, ₽", 14247.97, RUB, "Строка «Итого» в таблице «Фонды». Нет раздела — 0."),
]
POS = [
    ("ОФЗ 26245", "Облигации", 6, 5204.52, 506.74, 881.79),
    ("РЖД 1Р-44R", "Облигации", 17, 16528.93, 929.15, 976.00),
    ("ВИМ - Индекс Мосбиржи", "Фонды", 55, 6839.25, 126.85, 118.65),
    ("Ликвидность", "Фонды", 3532, 7408.72, 2.10, 2.07),
]
COUP = [("РЖД 1Р-44R", dt.date(2026, 9, 24), 194.99)]

RULES = [
    ("Шаблон отчёта ВТБ «Аналитика портфеля», версия 2", True),
    ("Заполните листы «Отчёт», «Позиции», «Купоны» по PDF-отчёту ВТБ за один календарный месяц и загрузите файл в кабинете. Формат только .xlsx.", False),
    ("", False),
    ("Правила", True),
    ("1. Не переименовывайте листы, поля в колонке «Поле» и заголовки колонок. Не меняйте поле «Версия шаблона».", False),
    ("2. Все суммы в рублях, числом с копейками, без знака, без символа ₽. Ячейка должна быть числом, а не текстом.", False),
    ("3. Даты — настоящие даты (формат ДД.ММ.ГГГГ). Период «с» и «по» должен лежать в одном месяце, как в отчёте за месяц (01.09–30.09). Отчёт за несколько месяцев приложение не примет.", False),
    ("4. Если в отчёте стоит «-», пишите 0. Операции в валюте (доллар, евро) не поддерживаются: загрузка с ними невозможна.", False),
    ("5. Название бумаги пишите ровно как в отчёте. Если название в PDF занимает две строки, склейте в одну через пробел: «ВИМ - Индекс Мосбиржи».", False),
    ("6. «Раздел» выбирается из списка: Облигации, Фонды, Акции.", False),
    ("7. Цены на листе «Позиции» необязательны и не проверяются. Ничего не округляйте и не пересчитывайте: переписывайте числа из отчёта.", False),
    ("8. Приложение проверит: позиции + деньги = стоимость (допуск 1 ₽), суммы позиций по разделам = «Итого» из отчёта. Если не сходится, загрузка остановится с указанием места.", False),
    ("9. Если в отчёте нет раздела (например, «Полученные выплаты» или «Облигации»), оставьте лист пустым и поставьте 0 в «Итого». Порядок разделов в PDF может быть любым.", False),
    ("10. Жёлтые ячейки — для ввода.", False),
]


def header(ws, names):
    for j, h in enumerate(names, 1):
        c = ws.cell(1, j, h)
        c.font, c.fill, c.border = HEAD, FILL, B


def validation(ws, **kw):
    dv = DataValidation(allow_blank=True, showErrorMessage=True, **kw)
    ws.add_data_validation(dv)
    return dv


def build(path, example):
    wb = Workbook()
    ws = wb.active
    ws.title = "Инструкция"
    for i, (t, b) in enumerate(RULES, 1):
        c = ws.cell(i, 1, t)
        c.font = Font(bold=b, size=13 if i == 1 else 11)
        c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["A"].width = 110

    w = wb.create_sheet("Отчёт")
    header(w, ["Поле", "Значение", "Пояснение"])
    for i, (f, ex, fmt, hint) in enumerate(REPORT, 2):
        w.cell(i, 1, f).border = B
        v = w.cell(i, 2, ex if (example or f == "Версия шаблона") else None)
        v.number_format, v.border = fmt, B
        if f != "Версия шаблона":
            v.fill = INPUT
        h = w.cell(i, 3, hint)
        h.alignment, h.border = Alignment(wrap_text=True, vertical="top"), B
    for col, wd in zip("ABC", [30, 18, 95]):
        w.column_dimensions[col].width = wd
    w.freeze_panes = "A2"
    validation(w, type="date", operator="greaterThan", formula1="36526", errorTitle="Дата", error="Введите дату ДД.ММ.ГГГГ").add("B2:B3")
    validation(w, type="decimal", operator="greaterThanOrEqual", formula1="0", errorTitle="Сумма", error="Нужно число 0 или больше, без знака минус и без текста").add("B4:B12")

    p = wb.create_sheet("Позиции")
    header(p, ["Название", "Раздел", "Количество", "Стоимость, ₽", "Текущая цена, ₽", "Средняя цена, ₽"])
    rows = POS if example else []
    for i in range(2, 62):
        r = rows[i - 2] if i - 2 < len(rows) else (None,) * 6
        for j, v in enumerate(r, 1):
            c = p.cell(i, j, v)
            c.fill, c.border = INPUT, B
            if j == 3:
                c.number_format = "0"
            if j >= 4:
                c.number_format = RUB
    for col, wd in zip("ABCDEF", [40, 14, 13, 16, 16, 16]):
        p.column_dimensions[col].width = wd
    p.freeze_panes = "A2"
    validation(p, type="list", formula1='"Облигации,Фонды,Акции"', errorTitle="Раздел", error="Выберите: Облигации, Фонды или Акции").add("B2:B61")
    validation(p, type="whole", operator="greaterThan", formula1="0", error="Количество — целое число больше 0").add("C2:C61")
    validation(p, type="decimal", operator="greaterThanOrEqual", formula1="0", error="Нужно число 0 или больше").add("D2:F61")

    k = wb.create_sheet("Купоны")
    header(k, ["Название", "Дата выплаты", "Сумма, ₽"])
    rows = COUP if example else []
    for i in range(2, 62):
        r = rows[i - 2] if i - 2 < len(rows) else (None,) * 3
        for j, v in enumerate(r, 1):
            c = k.cell(i, j, v)
            c.fill, c.border = INPUT, B
            if j == 2:
                c.number_format = DATE
            if j == 3:
                c.number_format = RUB
    for col, wd in zip("ABC", [40, 16, 16]):
        k.column_dimensions[col].width = wd
    k.freeze_panes = "A2"
    validation(k, type="date", operator="greaterThan", formula1="36526", error="Введите дату ДД.ММ.ГГГГ").add("B2:B61")
    validation(k, type="decimal", operator="greaterThan", formula1="0", error="Сумма — число больше 0").add("C2:C61")
    wb.save(path)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    build(os.path.join(here, "template-report.xlsx"), False)
    build(os.path.join(here, "template-report-example.xlsx"), True)
