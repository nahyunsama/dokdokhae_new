'use client';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import 'react-quill-new/dist/quill.snow.css';
import { Lightbulb } from 'lucide-react';
import styles from './QuillEditor.module.css';

const SIZE_LIST = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

// 붙여넣기·끌어놓기로 올릴 수 있는 이미지 형식 (Storage 규칙의 허용 형식과 맞춘다)
const UPLOAD_MIMETYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const SUPPORTED_IMAGE_LABEL = 'JPG, PNG, GIF, WebP';

// 지원하지 않는 형식을 안내하는 메시지 (예: HEIC, SVG, PDF)
function unsupportedFileMessage(files) {
  const kinds = [...new Set(files.map((file) => {
    const ext = file.name?.includes('.') ? file.name.split('.').pop() : '';
    return (file.type ? file.type.split('/').pop().split('+')[0] : ext).toUpperCase() || '알 수 없음';
  }))];
  return `지원하지 않는 형식이에요. (${kinds.join(', ')})\n사용할 수 있는 이미지 형식: ${SUPPORTED_IMAGE_LABEL}`;
}

// Quill 업로더는 지원하지 않는 형식을 말없이 버리므로, 버리기 전에 사용자에게 먼저 안내한다.
// 이미지 업로드가 연결되지 않은 에디터(댓글 등)에서는 형식 안내 대신 기존 동작을 그대로 둔다.
function guardUnsupportedFiles(uploader, isUploadEnabled, notify = alert) {
  const originalUpload = uploader.upload;
  uploader.upload = function upload(range, files) {
    const list = Array.from(files);
    if (isUploadEnabled()) {
      const rejected = list.filter((file) => !UPLOAD_MIMETYPES.includes(file.type));
      if (rejected.length > 0) notify(unsupportedFileMessage(rejected));
    }
    return originalUpload.call(this, range, list);
  };
  return () => { uploader.upload = originalUpload; };
}

// 빈 에디터 정규화: Quill 기본 빈 상태('<p><br></p>')와 ''를 동일하게 취급
const normalizeHtml = (html) => (!html || html === '<p><br></p>') ? '' : html;

export default function QuillEditor({ value, onChange, placeholder, minHeight = 120, onImageUpload }) {
  const [ReactQuill, setReactQuill] = useState(null);
  const reactQuillRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const [menu, setMenu] = useState(null); // { x, y, img }
  const isComposing = useRef(false);
  // 사용자 입력으로 인한 변경 여부 추적 — true이면 value prop 변경이 자기 자신이 발생시킨 것
  const isSelfChange = useRef(false);
  // onImageUpload/onChange는 페이지에서 인라인 함수로 넘어와 매 렌더마다 참조가 바뀜.
  // ref로 우회해서 handleImageClick(→modules)이 항상 같은 참조를 유지하도록 함 —
  // modules 참조가 바뀌면 react-quill-new가 Quill 인스턴스를 통째로 destroy/재생성해서
  // 타이핑 중(특히 한글 조합 중)에 그 타이밍과 겹치면 자음분리가 발생함.
  const onImageUploadRef = useRef(onImageUpload);
  onImageUploadRef.current = onImageUpload;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('react-quill-new').then(({ default: RQ, Quill }) => {
      const SizeStyle = Quill.import('attributors/style/size');
      SizeStyle.whitelist = SIZE_LIST;
      Quill.register(SizeStyle, true);
      setReactQuill(() => RQ);
    });
  }, []);

  const getQuill = useCallback(() => {
    const node = reactQuillRef.current;
    if (!node) return null;
    try {
      if (typeof node.getEditor === 'function') return node.getEditor();
    } catch {
      return null;
    }
    return node.editor || null;
  }, []);

  const handleImageClick = useCallback(() => {
    if (!onImageUploadRef.current) {
      alert('이미지 업로드가 지원되지 않습니다.');
      return;
    }
    fileInputRef.current?.click();
  }, []);

  // 업로드가 끝난 이미지를 에디터에 넣고 기본 크기(img-md)를 지정한다. 다음 삽입 위치를 반환.
  const insertUploadedImage = useCallback((quill, url, index) => {
    // 업로드하는 동안 내용이 줄어들었을 수 있으므로 문서 끝을 넘지 않게 한다.
    const at = Math.min(index, Math.max(quill.getLength() - 1, 0));
    quill.insertEmbed(at, 'image', url, 'user');
    quill.insertText(at + 1, '\n', 'user');
    quill.setSelection(at + 2, 0);
    requestAnimationFrame(() => {
      const imgs = Array.from(quill.root?.querySelectorAll('img') || []);
      // 방금 넣은 이미지(같은 src)를 우선 찾고, 없으면 마지막 이미지
      const target = imgs.filter(img => img.getAttribute('src') === url).pop() || imgs[imgs.length - 1];
      if (target && !target.classList.contains('img-sm') && !target.classList.contains('img-md') && !target.classList.contains('img-lg')) {
        target.classList.add('img-md');
        if (onChangeRef.current) onChangeRef.current(quill.getSemanticHTML());
      }
    });
    return at + 2;
  }, []);

  const onFileChosen = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!UPLOAD_MIMETYPES.includes(file.type)) {
      alert(unsupportedFileMessage([file]));
      return;
    }
    const quill = getQuill();
    if (!quill) return;
    let range = quill.getSelection(true);
    if (!range) range = { index: quill.getLength(), length: 0 };
    try {
      const url = await onImageUploadRef.current(file);
      if (!url) return;
      insertUploadedImage(quill, url, range.index);
    } catch (err) {
      console.error('image upload failed', err);
      alert('이미지 업로드에 실패했어요.');
    }
  }, [getQuill, insertUploadedImage]);

  // 붙여넣기·끌어놓기로 들어온 이미지. Quill 기본 동작은 이미지를 base64로 본문에 넣는데,
  // 그러면 서버의 글자 수 제한을 넘고 sanitize에서도 제거된다.
  // 이미지 버튼과 똑같이 업로드한 뒤 주소(URL)만 본문에 넣는다.
  const uploadDroppedImages = useCallback(async (quill, range, files) => {
    if (!onImageUploadRef.current) {
      alert('이미지 업로드가 지원되지 않습니다.');
      return;
    }
    let index = range.index;
    if (range.length > 0) quill.deleteText(range.index, range.length, 'user');
    for (const file of files) {
      try {
        const url = await onImageUploadRef.current(file);
        if (url) index = insertUploadedImage(quill, url, index);
      } catch (err) {
        console.error('image upload failed', err);
        alert('이미지 업로드에 실패했어요.');
      }
    }
  }, [insertUploadedImage]);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }],
        [{ size: [false, ...SIZE_LIST] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'link', 'image'],
        ['clean'],
      ],
      handlers: { image: handleImageClick },
    },
    uploader: {
      mimetypes: UPLOAD_MIMETYPES,
      // Quill이 this를 Uploader 모듈로 지정해 호출하므로 화살표 함수가 아니라 메서드로 둔다.
      handler(range, files) {
        uploadDroppedImages(this.quill, range, files);
      },
    },
  }), [handleImageClick, uploadDroppedImages]);

  // 붙여넣기·끌어놓기로 들어온 파일이 지원하지 않는 형식이면 안내한다.
  useEffect(() => {
    if (!ReactQuill) return;
    const uploader = getQuill()?.uploader;
    if (!uploader) return;
    return guardUnsupportedFiles(uploader, () => !!onImageUploadRef.current);
  }, [ReactQuill, getQuill]);

  // iOS 한글 IME 버그 수정: 캡처 단계로 Quill 내부 핸들러보다 먼저 실행
  useEffect(() => {
    if (!ReactQuill) return;
    const quill = getQuill();
    if (!quill) return;
    const root = quill.root;

    const onStart = () => { isComposing.current = true; };
    const onEnd = () => { isComposing.current = false; };

    root.addEventListener('compositionstart', onStart, true);
    root.addEventListener('compositionend', onEnd, true);
    return () => {
      root.removeEventListener('compositionstart', onStart, true);
      root.removeEventListener('compositionend', onEnd, true);
    };
  }, [ReactQuill, getQuill]);

  // 외부 value 변경 시에만 Quill 내용 업데이트 (guide-1 방식 — 직접 API 호출)
  // isSelfChange가 true이면 사용자 타이핑이 부모 state를 바꿔 생긴 반향이므로 무시
  useEffect(() => {
    if (!ReactQuill) return;
    if (isSelfChange.current) { isSelfChange.current = false; return; }
    const quill = getQuill();
    if (!quill) return;
    const current = normalizeHtml(quill.root.innerHTML);
    const next = normalizeHtml(value);
    if (current === next) return;
    const delta = quill.clipboard.convert({ html: value ?? '' });
    quill.setContents(delta, 'api');
  }, [ReactQuill, value, getQuill]);

  // 에디터 내 이미지 클릭 → 플로팅 메뉴
  useEffect(() => {
    if (!ReactQuill) return;
    const quill = getQuill();
    if (!quill) return;
    const root = quill.root;

    function clearSelected() {
      root.querySelectorAll('img.is-selected').forEach(el => el.classList.remove('is-selected'));
    }

    function onClick(ev) {
      const target = ev.target;
      if (target && target.tagName === 'IMG') {
        ev.preventDefault();
        clearSelected();
        target.classList.add('is-selected');
        const rect = target.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;
        const MENU_W = 220;
        const MENU_H = 36;
        let x = rect.left - containerRect.left;
        x = Math.max(4, Math.min(x, containerRect.width - MENU_W - 4));
        let y = rect.top - containerRect.top - MENU_H - 6;
        if (y < 4) y = rect.bottom - containerRect.top + 6;
        setMenu({ x, y, img: target });
      } else {
        clearSelected();
        setMenu(null);
      }
    }
    root.addEventListener('click', onClick);
    return () => {
      root.removeEventListener('click', onClick);
      clearSelected();
    };
  }, [ReactQuill, getQuill]);

  useEffect(() => {
    return () => setMenu(null);
  }, []);

  const handleChange = useCallback((val) => {
    if (isComposing.current) return;
    // 이 변경은 사용자 입력에서 왔으므로, 부모 state 업데이트가 value prop을 바꿔도
    // DOM을 다시 건드리지 않도록 표시
    isSelfChange.current = true;
    if (onChange) onChange(val);
  }, [onChange]);

  const setSize = (cls) => {
    if (!menu?.img) return;
    menu.img.classList.remove('img-sm', 'img-md', 'img-lg');
    menu.img.classList.add(cls);
    const quill = getQuill();
    if (quill && onChange) onChange(quill.getSemanticHTML());
    setMenu(null);
  };

  const removeImg = () => {
    if (!menu?.img) return;
    menu.img.parentElement?.removeChild(menu.img);
    const quill = getQuill();
    if (quill && onChange) onChange(quill.getSemanticHTML());
    setMenu(null);
  };

  if (!ReactQuill) {
    return <div className={styles.loadingPlaceholder} style={{ height: minHeight }} />;
  }

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ minHeight }}
    >
      <ReactQuill
        ref={reactQuillRef}
        theme="snow"
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
        style={{ minHeight }}
      />
      {onImageUpload && (
        <div className={styles.hintBar}>
          <Lightbulb size={12} /> 이미지를 본문에 클릭하면 크기(작게/중간/크게)와 삭제 메뉴가 표시됩니다.
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChosen}
        className={styles.hiddenInput}
      />
      {menu && (
        <div className={styles.imageMenu} style={{ left: menu.x, top: menu.y }}>
          <button type="button" className="btn-sm btn-outline" onClick={() => setSize('img-sm')}>작게</button>
          <button type="button" className="btn-sm btn-outline" onClick={() => setSize('img-md')}>중간</button>
          <button type="button" className="btn-sm btn-outline" onClick={() => setSize('img-lg')}>크게</button>
          <button type="button" className="btn-sm btn-danger" onClick={removeImg}>삭제</button>
        </div>
      )}
    </div>
  );
}
