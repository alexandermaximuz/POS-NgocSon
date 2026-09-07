/**
 * Chuẩn hoá chuỗi tìm kiếm để khớp với `name_normalized` ở database.
 *
 * Cột đó là `generated always as (fn_unaccent_lower(name)) stored` (0003), tức là
 * `lower(unaccent(name))`. Muốn `ilike '%...%'` ăn được index trigram thì chuỗi
 * người dùng gõ phải đi qua đúng phép biến đổi ấy — làm ở TS để khỏi tốn thêm một
 * vòng gọi database cho mỗi lần gõ.
 *
 * `normalize("NFD")` tách được dấu của á à ả ã ạ ă â ê ô ơ ư, nhưng KHÔNG tách
 * được `đ`: đó là một chữ cái riêng (U+0111), không phải chữ có dấu. Thiếu dòng
 * thay `đ` → `d` thì gõ "do" không ra "Đỏ" trong khi gõ "duy thanh" vẫn ra
 * "Duy Thành", và lỗi kiểu đó rất khó nhận ra khi thử qua loa.
 */
export function normalizeSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D"))
    .toLowerCase()
    .trim();
}

/**
 * Thoát ký tự đặc biệt của `like` trước khi nhét vào `%...%`.
 *
 * Gõ `%` hay `_` vào ô tìm kiếm là chuyện bình thường (mã hàng có gạch dưới), và
 * không thoát thì `_` khớp mọi ký tự — kết quả trả về sai mà không ai báo lỗi.
 */
export function likePattern(input: string): string {
  const escaped = normalizeSearch(input)
    // PostgREST phân tách bộ lọc `or=(...)` bằng dấu phẩy và ngoặc. Một dấu phẩy
    // lọt vào đây làm câu truy vấn tách sai chỗ và trả về kết quả của một bộ lọc
    // khác hẳn, không báo lỗi. Bỏ hẳn nhóm ký tự đó — không ai tìm hàng bằng chúng.
    .replace(/[,()"]/g, " ")
    .replace(/[%_\\]/g, (c) => `\\${c}`)
    .trim();
  return `%${escaped}%`;
}

/**
 * Viết tắt màu thành đuôi mã biến thể: "Xanh dương" → "XD".
 *
 * Bản TS của `fn_variant_code_suffix` (0017). Hai bản tồn tại song song có chủ ý:
 * SQL dùng cho import, bản này chỉ GỢI Ý mã trong form và người dùng sửa được.
 * Nếu hai bản lệch nhau thì hậu quả lớn nhất là gợi ý khác với import, không phải
 * dữ liệu sai.
 */
export function variantCodeSuffix(color: string): string {
  return normalizeSearch(color)
    .split(/\s+/)
    .filter((w) => w !== "")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
