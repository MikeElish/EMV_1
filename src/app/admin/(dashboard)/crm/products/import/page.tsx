import { utils, write } from "xlsx";
import { CsvUploader } from "@/components/admin/CsvUploader";
import { CSV_TEMPLATE_HEADER, CSV_TEMPLATE_EXAMPLE } from "@/lib/validators/csv";

function buildXlsxTemplateHref() {
  const worksheet = utils.aoa_to_sheet([
    CSV_TEMPLATE_HEADER.split(","),
    CSV_TEMPLATE_EXAMPLE.split(","),
  ]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Товары");
  const base64 = write(workbook, { type: "base64", bookType: "xlsx" });
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
}

export default function ImportProductsPage() {
  const csvTemplateContent = `${CSV_TEMPLATE_HEADER}\n${CSV_TEMPLATE_EXAMPLE}\n`;
  const csvTemplateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvTemplateContent)}`;
  const xlsxTemplateHref = buildXlsxTemplateHref();

  return (
    <div>
      <h1 className="text-2xl font-bold">Импорт товаров из CSV или Excel</h1>
      <p className="mt-2 max-w-xl text-sm text-foreground/60">
        Столбцы считываются по порядку слева направо — названия в первой
        строке файла можно менять, главное не менять порядок:{" "}
        <strong>
          Бренд, Наименование товара, Артикул товара, Количество в наличии,
          Цена товара, Категория товара, Тип машины, Модель
          машины, Описание, Картинка
        </strong>
        .
      </p>
      <p className="mt-2 max-w-xl text-sm text-foreground/60">
        Обязательны только: <strong>Бренд, Наименование товара, Артикул
        товара, Цена товара, Категория товара</strong>. Если «Количество в
        наличии» пусто или равно 0, товар будет показан в магазине как
        «Под заказ».
      </p>
      <p className="mt-2 max-w-xl text-sm text-foreground/60">
        Товар обновляется по совпадению артикула, иначе создаётся новый.
        Ссылка на страницу товара формируется автоматически в формате
        «бренд_артикул».
        «Категория товара» можно указать как названием на русском (например,
        «Гидравлика»), так и slug уже существующей категории (посмотреть
        можно в списке категорий) — регистр не важен. Если запчасть
        подходит нескольким моделям техники, перечислите их в «Модель
        машины» через символ «|», например: <code>CAT 320|CAT 325</code>.
      </p>
      <p className="mt-2 max-w-xl text-sm text-foreground/60">
        Если в файле встречаются повторяющиеся артикулы или количество по
        файлу меньше уже загруженного в систему, после загрузки появится
        список для проверки — загрузка в базу произойдёт только после
        подтверждения.
      </p>

      <div className="mt-4 flex gap-4 text-sm">
        <a
          href={csvTemplateHref}
          download="emv-products-template.csv"
          className="underline underline-offset-4"
        >
          Скачать шаблон CSV
        </a>
        <a
          href={xlsxTemplateHref}
          download="emv-products-template.xlsx"
          className="underline underline-offset-4"
        >
          Скачать шаблон Excel (.xlsx)
        </a>
      </div>

      <div className="mt-8">
        <CsvUploader />
      </div>
    </div>
  );
}
