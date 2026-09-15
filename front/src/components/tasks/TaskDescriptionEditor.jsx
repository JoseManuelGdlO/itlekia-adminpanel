import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

// Kept in sync with the sanitizer allowlist: p br strong b em i u h1 h2 h3 ul ol li mark a.
export function buildTaskDescriptionExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      link: false,
      underline: false,
    }),
    Underline,
    Highlight,
    Link.configure({ openOnClick: false, autolink: true }),
    Placeholder.configure({ placeholder: 'Descripción' }),
  ];
}

export default function TaskDescriptionEditor({
  value,
  onChange,
  editable = true,
  ariaLabel = 'Descripción',
}) {
  const editor = useEditor({
    editable,
    extensions: buildTaskDescriptionExtensions(),
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const next = value || '';
    if (editor.getHTML() === next) return;
    editor.commands.setContent(next, false);
  }, [editor, value]);

  if (!editor) return null;

  function setLink() {
    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div>
      {editable && (
        <div className="mb-1 flex flex-wrap gap-1 text-xs">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>N</button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}>S</button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
          <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()}>Resaltar</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>Lista</button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>Lista numerada</button>
          <button type="button" onClick={setLink}>Enlace</button>
        </div>
      )}
      <div
        aria-label={ariaLabel}
        className="task-description-html rounded border border-border bg-background px-2 py-1 text-sm"
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
