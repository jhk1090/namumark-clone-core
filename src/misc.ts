import crypto from "crypto";

export const urlPas = (data: string) => {
  return encodeURIComponent(data.replace(/^\./g, "\\\\.")).replaceAll("/", "%2F");
};

export function sha224Replace(data: string) {
  return crypto.createHash("sha224").update(data, "utf-8").digest("hex");
}

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

export function unescapeHtml(html: string) {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

export const globalRegExp = (regexp: RegExp) => {
  return new RegExp(regexp, "g");
};