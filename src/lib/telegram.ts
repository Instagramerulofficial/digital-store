import { env } from "@/lib/env";

/**
 * Minimal Telegram Bot API client — no external dependency.
 * Bot token + channel id are optional; every method fails gracefully
 * with { ok: false, skipped: true } when not configured so the rest
 * of the app keeps working locally.
 */

type TelegramResult<T> =
  | { ok: true; result: T }
  | { ok: false; skipped?: true; error: string };

async function call<T>(
  method: string,
  payload: Record<string, unknown>,
): Promise<TelegramResult<T>> {
  if (!env.telegramBotToken) {
    return { ok: false, skipped: true, error: "TELEGRAM_BOT_TOKEN not set" };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${env.telegramBotToken}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = (await res.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    if (!json.ok || !res.ok) {
      return {
        ok: false,
        error: json.description ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, result: json.result as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export type TelegramMessage = {
  message_id: number;
  chat: { id: number; title?: string; username?: string };
  date: number;
};

/**
 * Post a plain message to the configured channel.
 * We use HTML parse mode because it's more forgiving than Markdown.
 */
export async function sendChannelMessage(args: {
  text: string;
  linkPreview?: boolean;
  buttonText?: string;
  buttonUrl?: string;
}): Promise<TelegramResult<TelegramMessage>> {
  if (!env.telegramChannelId) {
    return {
      ok: false,
      skipped: true,
      error: "TELEGRAM_CHANNEL_ID not set",
    };
  }

  const payload: Record<string, unknown> = {
    chat_id: env.telegramChannelId,
    text: args.text,
    parse_mode: "HTML",
    link_preview_options: {
      is_disabled: args.linkPreview === false,
    },
  };

  if (args.buttonText && args.buttonUrl) {
    payload.reply_markup = {
      inline_keyboard: [
        [{ text: args.buttonText, url: args.buttonUrl }],
      ],
    };
  }

  return call<TelegramMessage>("sendMessage", payload);
}

/**
 * Post a photo with caption to the configured channel.
 */
export async function sendChannelPhoto(args: {
  photoUrl: string;
  caption: string;
  buttonText?: string;
  buttonUrl?: string;
}): Promise<TelegramResult<TelegramMessage>> {
  if (!env.telegramChannelId) {
    return {
      ok: false,
      skipped: true,
      error: "TELEGRAM_CHANNEL_ID not set",
    };
  }

  const payload: Record<string, unknown> = {
    chat_id: env.telegramChannelId,
    photo: args.photoUrl,
    caption: args.caption,
    parse_mode: "HTML",
  };

  if (args.buttonText && args.buttonUrl) {
    payload.reply_markup = {
      inline_keyboard: [
        [{ text: args.buttonText, url: args.buttonUrl }],
      ],
    };
  }

  return call<TelegramMessage>("sendPhoto", payload);
}

/** Escapes characters that have special meaning in Telegram HTML mode. */
export function escapeTelegramHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Quick check the caller can do before attempting to post. */
export function isTelegramConfigured(): boolean {
  return Boolean(env.telegramBotToken && env.telegramChannelId);
}
