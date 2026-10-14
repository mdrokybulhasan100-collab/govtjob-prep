import { useEffect, useRef } from "react";

const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "P", "BR", "UL", "OL", "LI"]);
export function sanitizeRichHtml(input = "") {
  if (!/<\/?(b|strong|i|em|u|p|br|ul|ol|li)(\s|\/?>)/i.test(input)) {
    return String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  }
  if (typeof document === "undefined") return input;
  const doc = new DOMParser().parseFromString(input, "text/html");
  const clean = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 1) {
        if (!ALLOWED_TAGS.has(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent || ""));
        } else {
          [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
          clean(child);
        }
      } else if (child.nodeType !== 3) child.remove();
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

export function RichTextContent({ value = "", className = "" }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(value) }} />;
}

export default function RichTextEditor({ value = "", onChange, rows = 3 }) {
  const editorRef = useRef(null);
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value || "";
  }, [value]);
  const command = (cmd) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null);
    onChange?.(editorRef.current?.innerHTML || "");
  };
  return <div className="rich-editor-wrap">
    <div className="rich-editor-toolbar" role="toolbar" aria-label="ব্যাখ্যা ফরম্যাট">
      <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => command("bold")}><b>B</b></button>
      <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => command("italic")}><i>I</i></button>
      <button type="button" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => command("underline")}><u>U</u></button>
      <button type="button" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => command("insertUnorderedList")}>• তালিকা</button>
      <button type="button" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => command("insertOrderedList")}>1. তালিকা</button>
    </div>
    <div ref={editorRef} className="rich-editor" contentEditable role="textbox" aria-multiline="true" data-placeholder="ব্যাখ্যা লিখুন..." style={{ minHeight: `${Math.max(3, rows) * 24}px` }} onInput={(e) => onChange?.(e.currentTarget.innerHTML)} />
  </div>;
}
