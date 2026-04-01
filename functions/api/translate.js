const MODEL = "@cf/meta/m2m100-1.2b";
const MAX_SOURCE_CHARACTERS = 2500;
const SUPPORTED_LANGUAGES = new Set(["en", "es"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=UTF-8",
    },
  });
}

function normalizeLanguage(language) {
  return language === "es" ? "es" : "en";
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function formatHashtagWord(word) {
  if (!word) {
    return "";
  }

  if (word.length <= 2 && word === word.toUpperCase()) {
    return word;
  }

  const tail = word === word.toLowerCase() ? word.slice(1).toLowerCase() : word.slice(1);
  return word.charAt(0).toUpperCase() + tail;
}

function hashtagTokenToPhrase(token) {
  return String(token || "")
    .replace(/^#+/, "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHashtagToken(text) {
  const words = String(text || "")
    .replace(/['’]+/g, "")
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  if (!words.length) {
    return "";
  }

  return `#${words.map(formatHashtagWord).join("")}`;
}

function splitHashtags(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

async function runTranslation(env, text, sourceLanguage, targetLanguage) {
  const response = await env.AI.run(MODEL, {
    text,
    source_lang: sourceLanguage,
    target_lang: targetLanguage,
  });

  const translatedText =
    typeof response?.translated_text === "string"
      ? response.translated_text
      : typeof response?.result?.translated_text === "string"
        ? response.result.translated_text
        : "";

  if (!translatedText.trim()) {
    throw new Error("Translation service returned an empty response.");
  }

  return translatedText.trim();
}

async function translateHashtags(env, hashtags, sourceLanguage, targetLanguage) {
  const tokens = splitHashtags(hashtags);
  if (!tokens.length) {
    return "";
  }

  const translatedTokens = await Promise.all(
    tokens.map(async (token) => {
      const phrase = hashtagTokenToPhrase(token);
      if (!phrase) {
        return "";
      }

      if (!/[\p{L}]/u.test(phrase)) {
        return buildHashtagToken(phrase);
      }

      try {
        const translated = await runTranslation(env, phrase, sourceLanguage, targetLanguage);
        return buildHashtagToken(translated) || buildHashtagToken(phrase);
      } catch (error) {
        return buildHashtagToken(phrase);
      }
    }),
  );

  return Array.from(new Set(translatedTokens.filter(Boolean))).join(" ");
}

export async function onRequestPost(context) {
  if (!context.env?.AI || typeof context.env.AI.run !== "function") {
    return json({ error: "Workers AI binding is not configured." }, 500);
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch (error) {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  const sourceLanguage = normalizeLanguage(payload?.sourceLanguage);
  const targetLanguage = normalizeLanguage(payload?.targetLanguage);
  const sourceText = normalizeText(payload?.sourceText);
  const hashtags = String(payload?.hashtags || "").trim();

  if (!SUPPORTED_LANGUAGES.has(sourceLanguage) || !SUPPORTED_LANGUAGES.has(targetLanguage)) {
    return json({ error: "Only English and Spanish are supported." }, 400);
  }

  if (sourceLanguage === targetLanguage) {
    return json({ error: "Source and target languages must be different." }, 400);
  }

  if (!sourceText) {
    return json({ error: "Source text is required." }, 400);
  }

  if (sourceText.length > MAX_SOURCE_CHARACTERS) {
    return json(
      {
        error: `Translation currently supports up to ${MAX_SOURCE_CHARACTERS} characters in the source text.`,
      },
      400,
    );
  }

  try {
    const [translatedText, translatedHashtags] = await Promise.all([
      runTranslation(context.env, sourceText, sourceLanguage, targetLanguage),
      translateHashtags(context.env, hashtags, sourceLanguage, targetLanguage),
    ]);

    return json({
      translatedText,
      translatedHashtags,
      sourceLanguage,
      targetLanguage,
    });
  } catch (error) {
    return json(
      {
        error:
          typeof error?.message === "string" && error.message.trim()
            ? error.message
            : "Translation failed.",
      },
      502,
    );
  }
}
