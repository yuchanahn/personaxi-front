Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$localesRoot = Join-Path $projectRoot "src\lib\i18n\locales"
$staticRoot = Join-Path $projectRoot "static"

function Get-LangMeta {
    param([string]$Lang)

    switch ($Lang) {
        "ko" {
            return @{
                Locale = "ko_KR"
                Font = '"Noto Sans KR", system-ui, sans-serif'
                HomeLabel = "홈"
                FaqLabel = "FAQ"
                TermsLabel = "이용약관"
                PrivacyLabel = "개인정보처리방침"
            }
        }
        "ja" {
            return @{
                Locale = "ja_JP"
                Font = '"Noto Sans JP", system-ui, sans-serif'
                HomeLabel = "ホーム"
                FaqLabel = "FAQ"
                TermsLabel = "利用規約"
                PrivacyLabel = "プライバシーポリシー"
            }
        }
        default {
            return @{
                Locale = "en_US"
                Font = '"Noto Sans", system-ui, sans-serif'
                HomeLabel = "Home"
                FaqLabel = "FAQ"
                TermsLabel = "Terms"
                PrivacyLabel = "Privacy"
            }
        }
    }
}

function New-AlternateLinks {
    param(
        [string]$BaseName,
        [hashtable]$SuffixMap
    )

    $langs = @("ko", "en", "ja")
    $lines = foreach ($lang in $langs) {
        $suffix = $SuffixMap[$lang]
        $href = if ([string]::IsNullOrWhiteSpace($suffix)) {
            "https://personaxi.com/$BaseName.html"
        } else {
            "https://personaxi.com/$BaseName-$suffix.html"
        }

        "    <link rel=`"alternate`" hreflang=`"$lang`" href=`"$href`" />"
    }

    $defaultHref = "https://personaxi.com/$BaseName-en.html"
    return ($lines + "    <link rel=`"alternate`" hreflang=`"x-default`" href=`"$defaultHref`" />") -join "`n"
}

function New-StaticLegalDoc {
    param(
        [string]$MarkdownPath,
        [string]$OutputPath,
        [string]$Title,
        [string]$Description,
        [string]$Lang,
        [string]$CanonicalUrl,
        [string]$Alternates,
        [string]$DocType
    )

    $meta = Get-LangMeta -Lang $Lang
    $markdown = ConvertFrom-Markdown -Path $MarkdownPath
    $contentHtml = $markdown.Html

    $navTermsHref = if ($Lang -eq "ko") { "/terms.html" } else { "/terms-$Lang.html" }
    $navPrivacyHref = if ($Lang -eq "ko") { "/privacy.html" } else { "/privacy-$Lang.html" }

    $html = @"
<!doctype html>
<html lang="$Lang">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>$Title</title>
    <meta name="description" content="$Description" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <link rel="canonical" href="$CanonicalUrl" />
$Alternates
    <meta property="og:type" content="article" />
    <meta property="og:url" content="$CanonicalUrl" />
    <meta property="og:title" content="$Title" />
    <meta property="og:description" content="$Description" />
    <meta property="og:image" content="https://personaxi.com/og-image.png" />
    <meta property="og:site_name" content="PersonaXi" />
    <meta property="og:locale" content="$($meta.Locale)" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="$Title" />
    <meta name="twitter:description" content="$Description" />
    <meta name="twitter:image" content="https://personaxi.com/og-image.png" />
    <link rel="icon" href="/favicon.png" />
    <style>
        :root {
            color-scheme: light;
            --bg: #f6f4ef;
            --fg: #1f2937;
            --muted: #596273;
            --line: #d8dde5;
            --link: #14532d;
            --surface: #ffffff;
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            font-family: $($meta.Font);
            color: var(--fg);
            background: var(--bg);
            line-height: 1.75;
        }

        main {
            width: min(860px, calc(100% - 32px));
            margin: 0 auto;
            padding: 40px 0 72px;
        }

        .doc {
            background: var(--surface);
            border: 1px solid var(--line);
            padding: 28px 24px 40px;
        }

        .eyebrow {
            margin: 0 0 8px;
            color: var(--muted);
            font-size: 0.84rem;
        }

        .lead {
            margin: 0 0 20px;
            color: var(--muted);
        }

        .nav {
            display: flex;
            flex-wrap: wrap;
            gap: 14px;
            padding: 0 0 20px;
            margin: 0 0 20px;
            border-bottom: 1px solid var(--line);
        }

        a {
            color: var(--link);
            text-underline-offset: 2px;
        }

        article h1,
        article h2,
        article h3,
        article h4 {
            line-height: 1.32;
            margin-top: 1.6em;
            margin-bottom: 0.65em;
        }

        article h1 {
            margin-top: 0;
            font-size: 2rem;
        }

        article h2 { font-size: 1.4rem; }
        article h3 { font-size: 1.1rem; }
        article h4 { font-size: 1rem; }

        article p,
        article ul,
        article ol,
        article table,
        article blockquote {
            margin: 0 0 14px;
        }

        article ul,
        article ol {
            padding-left: 22px;
        }

        article hr {
            border: 0;
            border-top: 1px solid var(--line);
            margin: 28px 0;
        }

        article table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.96rem;
        }

        article th,
        article td {
            border: 1px solid var(--line);
            padding: 10px 12px;
            vertical-align: top;
            text-align: left;
        }

        article code {
            font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
            font-size: 0.92em;
        }

        .note {
            margin-top: 28px;
            color: var(--muted);
            font-size: 0.95rem;
        }
    </style>
</head>
<body>
    <main>
        <div class="doc">
            <p class="eyebrow">PersonaXi $DocType</p>
            <p class="lead">$Description</p>
            <nav class="nav">
                <a href="/">$($meta.HomeLabel)</a>
                <a href="/faq.html">$($meta.FaqLabel)</a>
                <a href="$navTermsHref">$($meta.TermsLabel)</a>
                <a href="$navPrivacyHref">$($meta.PrivacyLabel)</a>
            </nav>
            <article>
$contentHtml
            </article>
            <p class="note">Static legal document generated from the repository markdown source.</p>
        </div>
    </main>
</body>
</html>
"@

    $dir = Split-Path -Parent $OutputPath
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    Set-Content -Path $OutputPath -Value $html -Encoding utf8
}

$termsAlternates = New-AlternateLinks -BaseName "terms" -SuffixMap @{
    ko = ""
    en = "en"
    ja = "ja"
}

$privacyAlternates = New-AlternateLinks -BaseName "privacy" -SuffixMap @{
    ko = ""
    en = "en"
    ja = "ja"
}

$docs = @(
    @{
        MarkdownPath = Join-Path $localesRoot "ko\terms.md"
        OutputPath   = Join-Path $staticRoot "terms.html"
        Title        = "PersonaXi 이용약관"
        Description  = "PersonaXi 서비스 이용약관 정적 문서."
        Lang         = "ko"
        CanonicalUrl = "https://personaxi.com/terms.html"
        Alternates   = $termsAlternates
        DocType      = "Terms"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "en\terms.md"
        OutputPath   = Join-Path $staticRoot "terms-en.html"
        Title        = "PersonaXi Terms of Service"
        Description  = "Static Terms of Service document for PersonaXi."
        Lang         = "en"
        CanonicalUrl = "https://personaxi.com/terms-en.html"
        Alternates   = $termsAlternates
        DocType      = "Terms"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "ja\terms.md"
        OutputPath   = Join-Path $staticRoot "terms-ja.html"
        Title        = "PersonaXi Terms of Service"
        Description  = "Static Terms of Service document for PersonaXi."
        Lang         = "ja"
        CanonicalUrl = "https://personaxi.com/terms-ja.html"
        Alternates   = $termsAlternates
        DocType      = "Terms"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "ko\policy.md"
        OutputPath   = Join-Path $staticRoot "privacy.html"
        Title        = "PersonaXi 개인정보처리방침"
        Description  = "PersonaXi 개인정보처리방침 정적 문서."
        Lang         = "ko"
        CanonicalUrl = "https://personaxi.com/privacy.html"
        Alternates   = $privacyAlternates
        DocType      = "Privacy"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "en\policy.md"
        OutputPath   = Join-Path $staticRoot "privacy-en.html"
        Title        = "PersonaXi Privacy Policy"
        Description  = "Static Privacy Policy document for PersonaXi."
        Lang         = "en"
        CanonicalUrl = "https://personaxi.com/privacy-en.html"
        Alternates   = $privacyAlternates
        DocType      = "Privacy"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "ja\policy.md"
        OutputPath   = Join-Path $staticRoot "privacy-ja.html"
        Title        = "PersonaXi Privacy Policy"
        Description  = "Static Privacy Policy document for PersonaXi."
        Lang         = "ja"
        CanonicalUrl = "https://personaxi.com/privacy-ja.html"
        Alternates   = $privacyAlternates
        DocType      = "Privacy"
    }
)

foreach ($doc in $docs) {
    New-StaticLegalDoc @doc
}

Copy-Item -Path (Join-Path $staticRoot "privacy.html") -Destination (Join-Path $staticRoot "policy.html") -Force
Copy-Item -Path (Join-Path $staticRoot "privacy-en.html") -Destination (Join-Path $staticRoot "policy-en.html") -Force
Copy-Item -Path (Join-Path $staticRoot "privacy-ja.html") -Destination (Join-Path $staticRoot "policy-ja.html") -Force

foreach ($dirName in @("terms", "privacy", "policy")) {
    $dirPath = Join-Path $staticRoot $dirName
    if (-not (Test-Path $dirPath)) {
        New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
    }
}

Copy-Item -Path (Join-Path $staticRoot "terms.html") -Destination (Join-Path $staticRoot "terms\index.html") -Force
Copy-Item -Path (Join-Path $staticRoot "privacy.html") -Destination (Join-Path $staticRoot "privacy\index.html") -Force
Copy-Item -Path (Join-Path $staticRoot "policy.html") -Destination (Join-Path $staticRoot "policy\index.html") -Force
