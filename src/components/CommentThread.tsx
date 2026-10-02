"use client";

import { useCallback, useEffect, useState } from "react";
import { CornerDownRight, Heart, MessagesSquare } from "lucide-react";
import { addComment, deleteComment, editComment, getCurrentUser, getUserName, listComments, toggleLike } from "@/lib/api";
import type { Comment } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import Avatar from "./Avatar";

/** 자료 상세의 팀 의견(댓글) — 댓글 + 답글 1단계 + 공감 */
export default function CommentThread({ articleId }: { articleId: string }) {
  const me = getCurrentUser();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const reload = useCallback(() => listComments(articleId).then(setComments), [articleId]);
  useEffect(() => {
    reload();
  }, [reload]);

  const roots = (comments ?? []).filter((c) => !c.parentId);
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.parentId === id);

  return (
    <section className="glass p-6 md:p-8">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <MessagesSquare size={19} className="text-violet-500" />
        팀 의견 <span className="text-violet-500">{comments?.length ?? ""}</span>
      </h2>
      <p className="mt-1 text-xs text-ink-faint">이 자료에 대한 생각, 우리 팀에 미칠 영향, 추가로 볼 자료를 자유롭게 나눠요.</p>

      <div className="mt-5">
        <Composer
          userId={me.id}
          placeholder="의견을 남겨주세요 (Enter 등록, Shift+Enter 줄바꿈)"
          onSubmit={async (text) => {
            await addComment(articleId, text);
            reload();
          }}
        />
      </div>

      {comments === null && <div className="skeleton mt-6 h-24" />}
      {comments?.length === 0 && (
        <p className="mt-6 rounded-xl bg-white/60 p-6 text-center text-sm text-ink-faint">
          아직 의견이 없어요. 첫 의견을 남겨보세요!
        </p>
      )}

      <ul className="mt-6 space-y-5">
        {roots.map((c) => (
          <li key={c.id}>
            <CommentItem comment={c} meId={me.id} onChanged={reload} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} />
            {(repliesOf(c.id).length > 0 || replyTo === c.id) && (
              <ul className="mt-3 space-y-3 border-l-2 border-violet-100 pl-4 md:ml-11">
                {repliesOf(c.id).map((r) => (
                  <li key={r.id}>
                    <CommentItem comment={r} meId={me.id} onChanged={reload} onReply={() => setReplyTo(c.id)} small />
                  </li>
                ))}
                {replyTo === c.id && (
                  <li>
                    <Composer
                      userId={me.id}
                      autoFocus
                      small
                      placeholder={`${getUserName(c.authorId)}님에게 답글`}
                      onCancel={() => setReplyTo(null)}
                      onSubmit={async (text) => {
                        await addComment(articleId, text, c.id);
                        setReplyTo(null);
                        reload();
                      }}
                    />
                  </li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommentItem({
  comment: c,
  meId,
  onChanged,
  onReply,
  small,
}: {
  comment: Comment;
  meId: string;
  onChanged: () => void;
  onReply: () => void;
  small?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const mine = c.authorId === meId;
  const liked = c.likes.includes(meId);

  return (
    <div className="flex gap-3">
      <Avatar userId={c.authorId} size={small ? 28 : 34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{getUserName(c.authorId)}</span>
          <span className="text-[11px] text-ink-faint">{timeAgo(c.createdAt)}</span>
        </div>
        {editing ? (
          <div className="mt-1.5">
            <Composer
              userId={meId}
              initial={c.text}
              small
              autoFocus
              hideAvatar
              submitLabel="수정"
              onCancel={() => setEditing(false)}
              onSubmit={async (text) => {
                await editComment(c.id, text);
                setEditing(false);
                onChanged();
              }}
            />
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{c.text}</p>
        )}
        {!editing && (
          <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-faint">
            <button
              onClick={async () => {
                await toggleLike(c.id);
                onChanged();
              }}
              className={cn("flex items-center gap-1 transition hover:text-rose-500", liked && "text-rose-500")}
              aria-pressed={liked}
            >
              <Heart size={13} fill={liked ? "currentColor" : "none"} /> 공감 {c.likes.length > 0 && c.likes.length}
            </button>
            <button onClick={onReply} className="flex items-center gap-1 hover:text-violet-500">
              <CornerDownRight size={13} /> 답글
            </button>
            {mine && (
              <>
                <button onClick={() => setEditing(true)} className="hover:text-ink">
                  수정
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(c.parentId ? "답글을 삭제할까요?" : "의견을 삭제할까요? 달린 답글도 함께 삭제됩니다.")) return;
                    await deleteComment(c.id);
                    onChanged();
                  }}
                  className="hover:text-rose-500"
                >
                  삭제
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({
  userId,
  placeholder,
  onSubmit,
  onCancel,
  initial = "",
  autoFocus,
  small,
  hideAvatar,
  submitLabel = "등록",
}: {
  userId: string;
  placeholder?: string;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
  initial?: string;
  autoFocus?: boolean;
  small?: boolean;
  hideAvatar?: boolean;
  submitLabel?: string;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    await onSubmit(text);
    setText("");
    setBusy(false);
  };

  return (
    <div className="flex gap-3">
      {!hideAvatar && <Avatar userId={userId} size={small ? 28 : 34} />}
      <div className="flex-1 rounded-2xl border border-line bg-white/80 p-2 focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100">
        <textarea
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape" && onCancel) onCancel();
          }}
          rows={small ? 1 : 2}
          placeholder={placeholder}
          className="max-h-48 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none [field-sizing:content] placeholder:text-ink-faint"
        />
        <div className="flex justify-end gap-1.5">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1 text-xs text-ink-faint hover:bg-bg">
              취소
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || busy}
            className="rounded-lg bg-violet-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:bg-violet-200"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
