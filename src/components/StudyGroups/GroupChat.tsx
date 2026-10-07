// src/components/StudyGroups/GroupChat.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useGroupStore } from "../../Store/useGroupStore";
import type { ChatMessage, ReplyPreview } from "../../Store/useGroupStore";
import { useUserStore } from "../../Store/useUserStore";
import type { StudyGroup } from "../../Store/useGroupStore";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import MessageStatusIndicator from "./MessageStatusIndicator";
import { cn, sanitizeXss } from "../../lib/utils/utils";
import { getSubjectColor } from "../../lib/subjectMeta";
import { truncateInput } from "../../lib/validation";
import { motion, useAnimation } from "framer-motion";
import type { PanInfo } from "framer-motion";
import {
  ArrowLeft,
  Send,
  Users,
  Copy,
  Check,
  Loader2,
  Wifi,
  WifiOff,
  X,
  CornerDownRight,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

interface Props {
  group: StudyGroup;
  onBack: () => void;
}

// ── Reply Banner ────────────────────────────────────────
interface ReplyBannerProps {
  reply: ReplyPreview;
  onCancel: () => void;
}
const ReplyBanner: React.FC<ReplyBannerProps> = ({ reply, onCancel }) => (
  <div className="bg-bgSurface/95 border-brand animate-in slide-in-from-bottom-2 mb-1 flex items-center gap-3 border-t border-l-4 px-4 py-2.5 shadow-lg backdrop-blur-sm duration-200">
    <div className="bg-brand/10 text-brand shrink-0 rounded-lg p-1.5">
      <CornerDownRight className="h-4 w-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="text-brand text-[11px] font-black tracking-wider uppercase">
          Replying to {sanitizeXss(reply.author)}
        </p>
      </div>
      <p className="text-textDim mt-0.5 truncate text-xs italic opacity-80">
        "{sanitizeXss(reply.message)}"
      </p>
    </div>
    <button
      onClick={onCancel}
      className="bg-bgDeep/50 text-textDim hover:bg-bgDeep flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:text-white"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
);

// ── Quoted message bubble ───────────────────────────────
interface QuotedMsgProps {
  reply: ReplyPreview;
  isMe: boolean;
}
const QuotedMsg: React.FC<QuotedMsgProps> = ({ reply, isMe }) => (
  <div
    className={cn(
      "mb-1 w-full max-w-full overflow-hidden rounded border-l-2 px-2.5 py-1.5 text-[11px]",
      isMe ? "bg-brand/10 border-brand/20" : "bg-bgMain border-borderMuted",
    )}
  >
    <p
      className={cn(
        "mb-0.5 truncate font-bold",
        isMe ? "text-brand-light" : "text-brand",
      )}
    >
      {reply.author}
    </p>
    <p
      className={cn("truncate", isMe ? "text-brand-light/70" : "text-textDim")}
    >
      {reply.message}
    </p>
  </div>
);

// ── Network Banner ──────────────────────────────────────
interface NetworkBannerProps {
  quality: "good" | "slow" | "offline";
  wasOffline: boolean;
  pendingCount: number;
  onRetryAll: () => void;
}
const NetworkBanner: React.FC<NetworkBannerProps> = ({
  quality,
  wasOffline,
  pendingCount,
  onRetryAll,
}) => {
  if (quality === "good" && !wasOffline) return null;

  if (wasOffline && quality === "good") {
    return (
      <div className="bg-success/10 border-success/20 text-success-light dark:text-success animate-in slide-in-from-top-2 flex items-center justify-between gap-2 border-b px-4 py-2 text-xs font-medium duration-300">
        <span className="flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5" /> Back online
        </span>
        {pendingCount > 0 && (
          <button
            onClick={onRetryAll}
            className="flex items-center gap-1 underline hover:no-underline"
          >
            <RefreshCw className="h-3 w-3" /> Retry {pendingCount} failed
          </button>
        )}
      </div>
    );
  }

  if (quality === "offline") {
    return (
      <div className="bg-danger/10 border-danger/20 text-danger-light dark:text-danger flex items-center justify-between gap-2 border-b px-4 py-2 text-xs font-medium">
        <span className="flex items-center gap-1.5">
          <WifiOff className="h-3.5 w-3.5" /> No connection — messages will
          retry when online
        </span>
      </div>
    );
  }

  if (quality === "slow") {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> Slow connection — messages
          may be delayed
        </span>
      </div>
    );
  }

  return null;
};

// ── Swipeable Message Bubble ────────────────────────────
interface SwipeableBubbleProps {
  msg: ChatMessage;
  isMe: boolean;
  color: string;
  onReply: (msg: ChatMessage) => void;
  children: React.ReactNode;
}

const SwipeableBubble: React.FC<SwipeableBubbleProps> = ({
  msg,
  isMe,
  onReply,
  children,
}) => {
  const controls = useAnimation();
  const [swipeTriggered, setSwipeTriggered] = useState(false);

  const handleDragEnd = async (_: any, info: PanInfo) => {
    // If swiped more than 60px to the right (for others) or left (for me)
    const threshold = 60;
    const isSwipeRight = info.offset.x > threshold;
    const isSwipeLeft = info.offset.x < -threshold;

    if (isSwipeRight && !isMe) {
      onReply(msg);
    } else if (isSwipeLeft && isMe) {
      onReply(msg);
    }

    // Reset position
    controls.start({ x: 0 });
    setSwipeTriggered(false);
  };

  const handleDrag = (_: any, info: PanInfo) => {
    const threshold = 60;
    const currentX = info.offset.x;

    if ((!isMe && currentX > threshold) || (isMe && currentX < -threshold)) {
      if (!swipeTriggered) {
        setSwipeTriggered(true);
        // Haptic feedback could go here if available
      }
    } else {
      setSwipeTriggered(false);
    }
  };

  return (
    <div className="group/bubble relative flex w-full items-center">
      {/* Reply indicator that shows behind the bubble when swiping */}
      <div
        className={cn(
          "absolute inset-y-0 flex items-center transition-opacity duration-200",
          isMe ? "right-10" : "left-10",
          swipeTriggered ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="bg-brand/20 text-brand rounded-full p-2">
          <CornerDownRight className="h-5 w-5" />
        </div>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: isMe ? -100 : 0, right: isMe ? 0 : 100 }}
        dragElastic={0.2}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative w-full cursor-grab active:cursor-grabbing"
      >
        {children}

        {/* Desktop Hover Reply Button */}
        {!msg.id.startsWith("temp-") && msg.status !== "failed" && (
          <button
            onClick={() => onReply(msg)}
            className={cn(
              "bg-bgSurface border-borderMuted text-textMuted hover:text-brand hover:border-brand/40 absolute top-1/2 z-10 hidden -translate-y-1/2 scale-75 rounded-full border p-2 opacity-0 shadow-xl transition-all group-hover/bubble:scale-100 group-hover/bubble:opacity-100 md:flex",
              isMe ? "-left-12" : "-right-12",
            )}
          >
            <CornerDownRight className="h-4 w-4" />
          </button>
        )}
      </motion.div>
    </div>
  );
};

// ── Main component ──────────────────────────────────────
const GroupChat: React.FC<Props> = ({ group, onBack }) => {
  const { id: myId, name } = useUserStore();
  const {
    myGroupIds,
    loadMessages,
    sendMessage,
    retryMessage,
    subscribeToChat,
    getMessages,
    msgLoading,
    joinGroup,
  } = useGroupStore();

  const { isOnline, wasOffline, quality } = useNetworkStatus();

  // Safety check: if group is missing, don't crash
  // Move all hooks ABOVE this line to satisfy React rules
  const groupId = group?.id || "";
  const groupSubject = group?.subject || "Mixed";
  const groupName = group?.name || "";
  const groupIcon = group?.icon || "💬";
  const groupMemberCount = group?.member_count || 0;
  const groupJoinCode = group?.join_code || "";

  const messages = getMessages(groupId);
  const isMember = myGroupIds.includes(groupId);

  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const color = getSubjectColor(groupSubject);

  const failedInGroup = messages.filter((m) => m.status === "failed");

  // ── Load + subscribe ──────────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    loadMessages(groupId);
    const unsub = subscribeToChat(groupId);
    setConnected(true);

    return () => {
      unsub?.();
      setConnected(false);
    };
  }, [groupId, loadMessages, subscribeToChat]);

  // ── Auto-retry failed messages when back online ───────
  useEffect(() => {
    if (wasOffline && isOnline && failedInGroup.length > 0 && groupId) {
      failedInGroup.forEach((msg) => {
        retryMessage(groupId, msg.id);
      });
    }
  }, [wasOffline, isOnline, failedInGroup, groupId, retryMessage]);

  // ── Auto-scroll ───────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, replyTo]); // Also scrolls when reply container renders

  // ── Handlers ──────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (!text.trim() || !isMember || !isOnline || !groupId) return;

    // Explicitly pass replyTo parameters through the action layer
    sendMessage(groupId, text, replyTo);

    setText("");
    setReplyTo(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [text, isMember, isOnline, replyTo, groupId, sendMessage]);

  const handleReply = useCallback(
    (msg: ChatMessage) => {
      setReplyTo({
        id: msg.id,
        author: msg.user_id === myId ? name || "You" : msg.author,
        message: msg.message,
      });
      inputRef.current?.focus();
    },
    [myId, name],
  );

  const handleRetryAll = useCallback(() => {
    if (!groupId) return;
    failedInGroup.forEach((msg) => retryMessage(groupId, msg.id));
  }, [failedInGroup, groupId, retryMessage]);

  const copyJoinCode = useCallback(() => {
    if (!groupJoinCode) return;
    navigator.clipboard.writeText(groupJoinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [groupJoinCode]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!group) return null;

  return (
    // FIXED Layout: Removed restrictive max-height to allow chat to fill available viewport space
    // The parent container in StudyGroups.tsx already handles the fixed positioning and sidebar offset.
    <div className="bg-bgMain relative flex h-full w-full flex-col overflow-hidden">
      {/* ── Fixed group info header ────────────────────────── */}
      <div className="border-borderMuted bg-bgCard/95 z-30 shrink-0 border-b shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-2 md:py-2.5">
          <button
            onClick={onBack}
            className="bg-bgSurface hover:bg-bgDeep text-textMuted border-borderMuted flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all hover:text-white active:scale-90 md:h-9 md:w-9"
          >
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          </button>

          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg shadow-inner md:h-10 md:w-10 md:text-xl"
            style={{ background: `${color}15`, border: `1px solid ${color}30` }}
          >
            {groupIcon}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-sm font-bold tracking-tight">
              {sanitizeXss(groupName)}
            </p>
            <div className="text-textDim mt-0.5 flex items-center gap-2 text-[10px] font-semibold">
              <Users className="text-brand h-3 w-3" />
              <span>{groupMemberCount} members</span>
              <span className="text-textDim opacity-20">|</span>
              <span
                className={cn(
                  "flex items-center gap-1",
                  connected ? "text-success" : "text-amber-500",
                )}
              >
                {connected ? (
                  <>
                    <div className="bg-success h-1.5 w-1.5 animate-pulse rounded-full" />{" "}
                    Live
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" /> Syncing
                  </>
                )}
              </span>
            </div>
          </div>

          {isMember && (
            <button
              onClick={copyJoinCode}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 font-mono text-[10px] font-bold transition-all active:scale-95",
                copied
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-bgSurface border-borderMuted text-textMuted hover:border-brand/40 hover:text-textMain",
              )}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{groupJoinCode}</span>
            </button>
          )}
        </div>

        <NetworkBanner
          quality={quality}
          wasOffline={wasOffline}
          pendingCount={failedInGroup.length}
          onRetryAll={handleRetryAll}
        />
      </div>

      {/* ── Scrollable Messages Area ─────────────────────── */}
      <div className="custom-scrollbar bg-bgMain/40 flex w-full flex-1 flex-col space-y-1 overflow-y-auto px-4 py-4">
        {msgLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="text-brand h-8 w-8 animate-spin" />
            <p className="text-textDim text-xs font-medium">
              Fetching messages...
            </p>
          </div>
        )}

        {!msgLoading && messages.length === 0 && (
          <div className="text-textDim animate-in fade-in zoom-in my-auto flex flex-col items-center justify-center gap-4 py-12 duration-500">
            <div className="bg-bgSurface border-borderMuted flex h-20 w-20 items-center justify-center rounded-3xl border text-3xl shadow-xl">
              💬
            </div>
            <div className="text-center">
              <p className="text-textMain text-sm font-bold">
                No conversation yet
              </p>
              <p className="mt-1 text-xs">Be the first to break the ice!</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.user_id === myId;
          const isTemp = msg.id.startsWith("temp-");
          const isFailed = msg.status === "failed";
          const prevMsg = messages[idx - 1];

          // Grouping logic: check if message is part of a run
          const isFirstInGroup = !prevMsg || prevMsg.user_id !== msg.user_id;

          return (
            <div
              key={msg.id}
              className={cn(
                "group flex w-full gap-3 transition-all duration-200",
                isMe ? "flex-row-reverse" : "flex-row",
                isFirstInGroup ? "mt-4" : "mt-1",
              )}
            >
              {/* Avatar: Only show on first message of group */}
              <div className="flex h-8 w-8 shrink-0 items-end justify-center">
                {isFirstInGroup ? (
                  <div
                    className="border-borderMuted flex h-8 w-8 items-center justify-center rounded-xl border text-[11px] font-black text-white shadow-sm"
                    style={{ background: isMe ? color : "var(--bgSurface)" }}
                  >
                    {(isMe ? name || "Me" : msg.author || "U")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                ) : (
                  <div className="w-8" /> // Spacer
                )}
              </div>

              {/* Message Content */}
              <div
                className={cn(
                  "flex max-w-[80%] min-w-15 flex-col",
                  isMe ? "items-end" : "items-start",
                )}
              >
                {/* Name: ALWAYS show above each message as per requirements */}
                <p
                  className={cn(
                    "mb-1 px-1 text-[10px] font-bold tracking-wide",
                    isMe ? "text-brand-light" : "text-textDim",
                  )}
                >
                  {sanitizeXss(msg.author)}
                </p>

                {/* Quoted Message (Reply) */}
                {msg.reply_to && (
                  <div className="mb-1 w-full">
                    <QuotedMsg
                      reply={{
                        ...msg.reply_to,
                        author: sanitizeXss(msg.reply_to.author),
                        message: sanitizeXss(msg.reply_to.message),
                      }}
                      isMe={isMe}
                    />
                  </div>
                )}

                {/* Message Bubble */}
                <SwipeableBubble
                  msg={msg}
                  isMe={isMe}
                  color={color}
                  onReply={handleReply}
                >
                  <div
                    className={cn(
                      "px-4 py-2.5 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap shadow-sm transition-all",
                      isMe
                        ? "bg-brand rounded-2xl rounded-tr-sm text-white"
                        : "bg-bgCard border-borderMuted text-textMain rounded-2xl rounded-tl-sm border",
                      isFirstInGroup &&
                        (isMe ? "rounded-tr-sm" : "rounded-tl-sm"),
                      (isTemp || isFailed) && "opacity-60 grayscale-[0.5]",
                      isFailed && "border-danger/40 bg-danger/5",
                    )}
                  >
                    {sanitizeXss(msg.message)}
                  </div>
                </SwipeableBubble>

                {/* Status & Time */}
                <div
                  className={cn(
                    "mt-1 flex items-center gap-2 px-1",
                    isMe ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <span className="text-textDim/60 text-[9px] font-medium">
                    {isTemp ? "Sending…" : formatTime(msg.created_at)}
                  </span>

                  {isMe && (
                    <div className="flex items-center">
                      <MessageStatusIndicator
                        status={
                          msg.status ||
                          (msg.id.startsWith("temp-") ? "sending" : "delivered")
                        }
                        onRetry={
                          isFailed
                            ? () => retryMessage(groupId, msg.id)
                            : undefined
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} className="h-4 shrink-0" />
      </div>

      {/* ── Fixed Input Area ─────────────────────────────── */}
      <div
        className={cn(
          "bg-bgCard/95 pb-safe z-20 shrink-0 border-t backdrop-blur-sm transition-colors duration-300",
          isOnline ? "border-borderMuted" : "border-danger/50 bg-danger/2",
        )}
      >
        {isMember ? (
          <div className="flex w-full flex-col gap-2 p-2 md:p-3">
            {replyTo && (
              <ReplyBanner reply={replyTo} onCancel={() => setReplyTo(null)} />
            )}

            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  ref={inputRef as any}
                  rows={1}
                  value={text}
                  onChange={(e) => {
                    const v = truncateInput(e.target.value, 1000);
                    setText(v);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                    if (e.key === "Escape") setReplyTo(null);
                  }}
                  placeholder={
                    !isOnline
                      ? "Connection lost..."
                      : replyTo
                        ? `Reply to ${replyTo.author}…`
                        : "Type a message…"
                  }
                  disabled={!isOnline}
                  style={{ fontSize: "16px", minHeight: "40px" }}
                  className={cn(
                    "bg-bgSurface text-textMain placeholder:text-textDim focus:border-brand/50 custom-scrollbar w-full resize-none rounded-2xl border px-3 py-2 text-sm transition-all focus:outline-none md:px-4 md:py-3",
                    isOnline
                      ? "border-borderMuted"
                      : "border-danger/30 bg-danger/5 cursor-not-allowed opacity-60",
                  )}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!text.trim() || !isOnline}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all active:scale-90 md:h-11 md:w-11",
                  isOnline
                    ? "bg-brand hover:bg-brand-light shadow-brand/20 text-white"
                    : "bg-danger/20 text-danger/50 cursor-not-allowed shadow-none",
                )}
              >
                <Send className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>

            {!isOnline && (
              <div className="bg-danger/10 border-danger/20 animate-in fade-in slide-in-from-bottom-2 mt-1 flex flex-col items-center gap-1.5 rounded-xl border px-4 py-3 duration-300">
                <div className="text-danger flex items-center gap-2">
                  <WifiOff className="h-4 w-4 animate-pulse" />
                  <span className="text-[11px] font-black tracking-widest uppercase">
                    No Active Connection
                  </span>
                </div>
                <p className="text-danger/90 text-center text-[10px] leading-tight font-bold">
                  You are currently offline. Please check your network.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-bgCard p-4">
            <button
              onClick={() => joinGroup(groupId)}
              className="bg-brand/10 border-brand/20 text-brand-light hover:bg-brand/20 w-full rounded-xl border py-3 text-sm font-bold transition-all"
            >
              Join Group to Participate
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupChat;
