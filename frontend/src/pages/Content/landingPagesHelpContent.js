export const LANDING_PAGES_HELP = {
  intro:
    "Landing page je HTML stránka, na kterou uživatel dorazí po kliknutí z e-mailu. Měření OPEN/CLICK probíhá v e-mailu (pixel + přepis odkazů). Landing page pak umožňuje měřit návštěvu a odeslání formuláře přes token v URL – bez ukládání citlivých hodnot.",

  tracking: [
    "OPEN se měří přes tracking pixel v e-mailu: /t/o/<token>.gif. CLICK se měří přes přepsané odkazy: /t/c/<token>?u=<cílová_URL>.",
    "Odkazy v e-mailu směřující na landing page se automaticky doplní o parametr ?t=<token> (pokud chybí). Díky tomu se návštěva a submit na landing page přiřadí ke správnému uživateli kampaně.",
    "Landing page tracking se provádí na pozadí: při načtení stránky (pokud je v URL t=<token>) a při odeslání formuláře. Do databáze se ukládá pouze to, že byla stránka navštívena / že do formuláře bylo něco vyplněno – nikdy se neukládají konkrétní hodnoty (email/username/password).",
  ],

  rules: [
    "Používej čisté HTML + inline CSS. Externí JS/CSS nepoužívej (rychlost, kompatibilita, bezpečnost).",
    "Formuláře piš standardně (<form> + <input>). Aplikace sama blokuje skutečné odeslání hodnot a ukládá jen booleany (vyplněno/nevyplněno).",
    "Username/email pole musí být buď input[type=\"email\"], nebo mít v name/id některý z výrazů: email, user, login, username. Alternativně se vezme i vyplněný input[type=\"text\"] (jen pokud je ve stejném formuláři i input[type=\"password\"]). Vždy se ukládá jen informace vyplněno/nevyplněno, nikdy konkrétní hodnota.",
    "Obrázky vkládej přes Assets (absolutní URL), aby fungovaly i mimo interní síť.",
    "Landing page musí být otevíraná s tokenem (t=<token>). Bez tokenu se návštěva/submission nepřiřadí ke konkrétnímu uživateli.",
  ],

  example: `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ověření účtu</title>
  <style>
    body { margin:0; font-family:Arial, sans-serif; background:#f3f4f6; }
    .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { width:100%; max-width:520px; background:#fff; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,.08); padding:20px; }
    .field { margin:10px 0; }
    .label { display:block; font-size:12px; color:#374151; margin:0 0 6px; }
    .input { width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; }
    .btn { display:block; width:100%; text-align:center; background:#0597D9; color:#fff; text-decoration:none; padding:10px 14px; border-radius:8px; font-weight:700; border:none; cursor:pointer; }
    .muted { margin:12px 0 0; font-size:11px; color:#9ca3af; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1 style="margin:0 0 8px">Bezpečnostní ověření</h1>
      <p style="margin:0 0 14px; color:#6b7280; font-size:13px;">
        Pro pokračování potvrďte své přihlášení.
      </p>

      <img src="PASTE_ASSET_URL_HERE" alt="" style="display:block; width:100%; height:auto; margin:0 0 14px;" />

      <!-- Pozn.: aplikace měří submit a ukládá jen to, že bylo něco vyplněno (bez hodnot). -->
      <!-- Doporučení: vždy používej <form> a <button type="submit"> pro konzistentní měření. -->
      <form>
        <div class="field">
          <label class="label" for="email">E-mail</label>
          <input class="input" id="email" name="email" type="email" autocomplete="username" />
        </div>

        <div class="field">
          <label class="label" for="password">Heslo</label>
          <input class="input" id="password" name="password" type="password" autocomplete="current-password" />
        </div>

        <button class="btn" type="submit">Pokračovat</button>

        <p class="muted">
          Pokud jste akci neočekával(a), stránku zavřete.
        </p>
      </form>
    </div>
  </div>
</body>
</html>`,
};
