import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';

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

function ToolButton({ label, pressed, onClick, children }) {
  return (
    <Button
      type="button"
      variant={pressed ? 'secondary' : 'outline'}
      size="xs"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export default function TaskDescriptionEditor({
  value,
  onChange,
  editable = true,
  ariaLabel = 'Descripción',
}) {
  const skipNextUpdate = useRef(false);
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: buildTaskDescriptionExtensions(),
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false;
        return;
      }
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
    skipNextUpdate.current = true;
    editor.commands.setContent(next, { emitUpdate: false });
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
        <div className="mb-2 flex flex-wrap gap-1">
          <ToolButton
            label="Negrita"
            pressed={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            N
          </ToolButton>
          <ToolButton
            label="Cursiva"
            pressed={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </ToolButton>
          <ToolButton
            label="Subrayado"
            pressed={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            S
          </ToolButton>
          <ToolButton
            label="H1"
            pressed={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            H1
          </ToolButton>
          <ToolButton
            label="H2"
            pressed={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </ToolButton>
          <ToolButton
            label="H3"
            pressed={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            H3
          </ToolButton>
          <ToolButton
            label="Resaltar"
            pressed={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            Resaltar
          </ToolButton>
          <ToolButton
            label="Lista"
            pressed={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            Lista
          </ToolButton>
          <ToolButton
            label="Lista numerada"
            pressed={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            Lista numerada
          </ToolButton>
          <ToolButton label="Enlace" pressed={editor.isActive('link')} onClick={setLink}>
            Enlace
          </ToolButton>
        </div>
      )}
      <div
        aria-label={ariaLabel}
        className="task-description-html rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
