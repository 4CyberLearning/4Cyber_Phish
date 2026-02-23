export const LANDING_PAGES_HELP = {
  intro:
    "Landing page je HTML stránka, na kterou uživatel dorazí po kliknutí z e-mailu. Měření OPEN/CLICK probíhá v e-mailu (pixel + přepis odkazů). Landing page pak umožňuje měřit návštěvu a odeslání formuláře přes token v URL – bez ukládání citlivých hodnot.",

  tracking: [
    "OPEN se měří přes tracking pixel v e-mailu: /t/o/<token>.gif. CLICK se měří přes přepsané odkazy: /t/c/<token>?u=<cílová_URL>.",
    "Odkazy v e-mailech směřující na landing page se automaticky doplní o parametr ?t=<token> (pokud chybí). Díky tomu se návštěva a submit na landing page přiřadí ke správnému uživateli kampaně.",
    "Landing page tracking se provádí na pozadí: při načtení stránky (pokud je v URL t=<token>) a při odeslání formuláře. Do databáze se ukládá pouze to, že byla stránka navštívena / že do formuláře bylo něco vyplněno – nikdy se neukládají konkrétní hodnoty (email/username/password). Skripty pro tracking (/js/landing-tracking.js) se vkládají automaticky, není potřeba je přidávat ručně.",
  ],

  rules: [
    "Používej čisté HTML + inline CSS v <style> v hlavičce. Externí CSS je povoleno, externí JS do landing page NEpiš (řeší ho aplikace).",
    "JavaScript nesmí být inline kvůli Content-Security-Policy. Nepoužívej onclick, onsubmit, ani jiné inline event atributy. Nepřidávej vlastní <script> bloky do HTML.",
    "Interakce (přepínání kroků, blokování submitu) se řeší přes data-* atributy a sdílený skript /js/landing-ui.js, který se připojuje automaticky.",
    "Vícekrokové landingy: každý krok obal .lp-step + data-lp-step=\"název\". Tlačítka pro přechod mezi kroky použij s data-lp-next-step=\"cilovy-krok\" nebo data-lp-back-step=\"predchozi-krok\".",
    "Formuláře piš standardně (<form> + <input>). Pro sledování submitu stačí dát formuláři class=\"lp-form\". Pokud nechceš reálné odeslání, přidej data-lp-block-submit=\"1\" – aplikace submit zablokuje, ale zaznamená, že formulář byl odeslán.",
    "Username/email pole musí být buď input[type=\"email\"], nebo mít v name/id některý z výrazů: email, user, login, username. Alternativně se vezme i vyplněný input[type=\"text\"] (jen pokud je ve stejném formuláři i input[type=\"password\"]). Vždy se ukládá jen informace vyplněno/nevyplněno, nikdy konkrétní hodnota.",
    "Obrázky vkládej přes Assets (absolutní URL), aby fungovaly i mimo interní síť. Aplikace je při zobrazení přepíše na /uploads/… na stejné doméně.",
    "Landing page musí být otevíraná s tokenem (t=<token>). Bez tokenu se návštěva/submission nepřiřadí ke konkrétnímu uživateli (tracking skript se sice načte, ale bez tokenu nic neodešle).",
  ],

  example: `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ověření akce</title>
  <style>
    body { margin:0; font-family:Arial, sans-serif; background:#f3f4f6; }
    .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { width:100%; max-width:520px; background:#fff; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,.08); padding:20px; }
    .field { margin:10px 0; }
    .label { display:block; font-size:12px; color:#374151; margin:0 0 6px; }
    .input { width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; }
    .btn { display:block; width:100%; text-align:center; background:#0597D9; color:#fff; text-decoration:none; padding:10px 14px; border-radius:8px; font-weight:700; border:none; cursor:pointer; }
    .muted { margin:12px 0 0; font-size:11px; color:#9ca3af; }
    .hidden { display:none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">

      <!-- KROK 1: úvodní obrazovka -->
      <div class="lp-step" data-lp-step="step1">
        <h1 style="margin:0 0 8px">Bezpečnostní ověření</h1>
        <p style="margin:0 0 14px; color:#6b7280; font-size:13px;">
          Pro pokračování potvrďte, že jste akci skutečně zahájil(a).
        </p>

        <img src="PASTE_ASSET_URL_HERE" alt="" style="display:block; width:100%; height:auto; margin:0 0 14px;" />

        <button class="btn" type="button" data-lp-next-step="step2">
          Pokračovat
        </button>

        <p class="muted">
          Pokud akci neočekáváte, stránku zavřete.
        </p>
      </div>

      <!-- KROK 2: formulář – sleduje se submit -->
      <div class="lp-step hidden" data-lp-step="step2">
        <!-- Pozn.: aplikace měří submit a ukládá jen to, že bylo něco vyplněno (bez hodnot). -->
        <!-- class="lp-form" = landing-ui + landing-tracking reagují na odeslání -->
        <!-- data-lp-block-submit="1" = submit se neodešle na server, jen se změří -->
        <form class="lp-form" data-lp-block-submit="1">
          <div class="field">
            <label class="label" for="email">E-mail</label>
            <input class="input" id="email" name="email" type="email" autocomplete="username" />
          </div>

          <div class="field">
            <label class="label" for="code">Ověřovací kód</label>
            <input class="input" id="code" name="code" type="text" autocomplete="one-time-code" />
          </div>

          <button class="btn" type="submit">Potvrdit</button>

          <p class="muted">
            Údaje jsou použity pouze pro potřeby školení. Konkrétní hodnoty se nikdy neukládají.
          </p>
        </form>

        <button class="btn" type="button" style="margin-top:10px; background:#e5e7eb; color:#111827;"
                data-lp-back-step="step1">
          Zpět
        </button>
      </div>

    </div>
  </div>

  <!-- DŮLEŽITÉ:
       - Nepřidávej vlastní <script> ani onclick/onsubmit.
       - Aplikace automaticky vkládá:
         * /js/landing-tracking.js – měření open/submit (pokud je v URL t=<token>)
         * /js/landing-ui.js – přepínání kroků podle data-lp-step / data-lp-next-step / data-lp-back-step
  -->
</body>
</html>`,
};