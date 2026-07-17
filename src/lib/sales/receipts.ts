export function formatReceiptNumber(number: number) {
  return String(number).padStart(8, "0")
}
