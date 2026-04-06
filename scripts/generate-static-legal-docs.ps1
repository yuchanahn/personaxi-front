Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$localesRoot = Join-Path $projectRoot "src\lib\i18n\locales"
$staticRoot = Join-Path $projectRoot "static"
$appTemplatePath = Join-Path $projectRoot "src\app.template.html"
$appHtmlPath = Join-Path $projectRoot "src\app.html"
$offlineTemplatePath = Join-Path $staticRoot "offline.template.html"
$offlineHtmlPath = Join-Path $staticRoot "offline.html"
$manifestTemplatePath = Join-Path $staticRoot "manifest.template.json"
$manifestPath = Join-Path $staticRoot "manifest.json"
$brandingConfigPath = Join-Path $projectRoot "src\lib\branding\branding.config.json"
$branding = Get-Content -Path $brandingConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
$publicOrigin = $branding.publicOrigin.TrimEnd("/")
$apiOrigin = $branding.apiOrigin.TrimEnd("/")
$publicHost = ([uri]$publicOrigin).Host
$apiHost = ([uri]$apiOrigin).Host
$publicBrandName = [string]$branding.publicBrandName
$legalServiceName = [string]$branding.legalServiceName
$legalEntityName = [string]$branding.legalEntityName
$serviceSlug = [string]$branding.serviceSlug
$supportEmail = [string]$branding.supportEmail
$privacyEmail = [string]$branding.privacyEmail
$contactEmail = [string]$branding.contactEmail
$copyrightName = [string]$branding.copyrightName
$appTitle = "$publicBrandName - AI Chat, Your Way"
$appDescription = "From status panels to Live2D and VRM, $publicBrandName is the only AI chat platform where you can design how characters appear."
$ogImageUrl = "$publicOrigin/og-image-v3.png"

function Apply-BrandingText {
    param([string]$Text)

    $result = $Text
    $replacements = @(
        @("{{PUBLIC_BRAND_NAME}}", $publicBrandName),
        @("{{LEGAL_SERVICE_NAME}}", $legalServiceName),
        @("{{LEGAL_ENTITY_NAME}}", $legalEntityName),
        @("{{SERVICE_SLUG}}", $serviceSlug),
        @("{{PUBLIC_ORIGIN}}", $publicOrigin),
        @("{{API_ORIGIN}}", $apiOrigin),
        @("{{PUBLIC_HOST}}", $publicHost),
        @("{{API_HOST}}", $apiHost),
        @("{{SUPPORT_EMAIL}}", $supportEmail),
        @("{{PRIVACY_EMAIL}}", $privacyEmail),
        @("{{CONTACT_EMAIL}}", $contactEmail),
        @("{{COPYRIGHT_NAME}}", $copyrightName),
        @("{{APP_TITLE}}", $appTitle),
        @("{{APP_DESCRIPTION}}", $appDescription),
        @("{{OG_IMAGE_URL}}", $ogImageUrl)
    )

    foreach ($pair in $replacements) {
        $from = [string]$pair[0]
        $to = [string]$pair[1]
        if ($from -and $from -ne $to) {
            $result = $result.Replace($from, $to)
        }
    }

    return $result
}

function Write-BrandedTemplateFile {
    param(
        [string]$TemplatePath,
        [string]$OutputPath,
        [string]$GeneratedComment = ""
    )

    $template = Get-Content -Path $TemplatePath -Raw -Encoding utf8
    $output = Apply-BrandingText $template

    if ($GeneratedComment) {
        $output = $GeneratedComment + "`r`n" + $output
    }

    Set-Content -Path $OutputPath -Value $output -Encoding utf8
}

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
                LicensesLabel = "라이선스 및 권리 고지"
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
                LicensesLabel = "ライセンス"
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
                LicensesLabel = "Licenses"
            }
        }
    }
}

function New-LocalizedAlternateLinks {
    param([string]$BaseName)

    $langs = @("ko", "en", "ja")
    $lines = foreach ($lang in $langs) {
        "    <link rel=`"alternate`" hreflang=`"$lang`" href=`"$publicOrigin/$lang/$BaseName/`" />"
    }

    $defaultHref = "$publicOrigin/en/$BaseName/"
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
    $markdownSource = Get-Content -Path $MarkdownPath -Raw -Encoding utf8
    $markdown = ConvertFrom-Markdown -InputObject (Apply-BrandingText $markdownSource)
    $contentHtml = $markdown.Html

    $navTermsHref = "/$Lang/terms/"
    $navPrivacyHref = "/$Lang/privacy/"
    $navLicensesHref = "/$Lang/licenses/"

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
    <meta property="og:image" content="$ogImageUrl" />
    <meta property="og:site_name" content="$legalServiceName" />
    <meta property="og:locale" content="$($meta.Locale)" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="$Title" />
    <meta name="twitter:description" content="$Description" />
    <meta name="twitter:image" content="$ogImageUrl" />
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
            <p class="eyebrow">$legalServiceName $DocType</p>
            <p class="lead">$Description</p>
            <nav class="nav">
                <a href="/">$($meta.HomeLabel)</a>
                <a href="$navTermsHref">$($meta.TermsLabel)</a>
                <a href="$navPrivacyHref">$($meta.PrivacyLabel)</a>
                <a href="$navLicensesHref">$($meta.LicensesLabel)</a>
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

$termsAlternates = New-LocalizedAlternateLinks -BaseName "terms"
$privacyAlternates = New-LocalizedAlternateLinks -BaseName "privacy"
$licensesAlternates = New-LocalizedAlternateLinks -BaseName "licenses"

$docs = @(
    @{
        MarkdownPath = Join-Path $localesRoot "ko\terms.md"
        OutputPath   = Join-Path $staticRoot "ko\terms\index.html"
        Title        = "$legalServiceName 이용약관"
        Description  = "$legalServiceName 서비스 이용약관 정적 문서."
        Lang         = "ko"
        CanonicalUrl = "$publicOrigin/ko/terms/"
        Alternates   = $termsAlternates
        DocType      = "Terms"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "en\terms.md"
        OutputPath   = Join-Path $staticRoot "en\terms\index.html"
        Title        = "$legalServiceName Terms of Service"
        Description  = "Static Terms of Service document for $legalServiceName."
        Lang         = "en"
        CanonicalUrl = "$publicOrigin/en/terms/"
        Alternates   = $termsAlternates
        DocType      = "Terms"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "ja\terms.md"
        OutputPath   = Join-Path $staticRoot "ja\terms\index.html"
        Title        = "$legalServiceName Terms of Service"
        Description  = "Static Terms of Service document for $legalServiceName."
        Lang         = "ja"
        CanonicalUrl = "$publicOrigin/ja/terms/"
        Alternates   = $termsAlternates
        DocType      = "Terms"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "ko\policy.md"
        OutputPath   = Join-Path $staticRoot "ko\privacy\index.html"
        Title        = "$legalServiceName 개인정보처리방침"
        Description  = "$legalServiceName 개인정보처리방침 정적 문서."
        Lang         = "ko"
        CanonicalUrl = "$publicOrigin/ko/privacy/"
        Alternates   = $privacyAlternates
        DocType      = "Privacy"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "en\policy.md"
        OutputPath   = Join-Path $staticRoot "en\privacy\index.html"
        Title        = "$legalServiceName Privacy Policy"
        Description  = "Static Privacy Policy document for $legalServiceName."
        Lang         = "en"
        CanonicalUrl = "$publicOrigin/en/privacy/"
        Alternates   = $privacyAlternates
        DocType      = "Privacy"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "ja\policy.md"
        OutputPath   = Join-Path $staticRoot "ja\privacy\index.html"
        Title        = "$legalServiceName Privacy Policy"
        Description  = "Static Privacy Policy document for $legalServiceName."
        Lang         = "ja"
        CanonicalUrl = "$publicOrigin/ja/privacy/"
        Alternates   = $privacyAlternates
        DocType      = "Privacy"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "ko\licenses.md"
        OutputPath   = Join-Path $staticRoot "ko\licenses\index.html"
        Title        = "$legalServiceName 라이선스 및 권리 고지"
        Description  = "$legalServiceName 라이선스 및 2차 창작 권리 고지 정적 문서."
        Lang         = "ko"
        CanonicalUrl = "$publicOrigin/ko/licenses/"
        Alternates   = $licensesAlternates
        DocType      = "Licenses"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "en\licenses.md"
        OutputPath   = Join-Path $staticRoot "en\licenses\index.html"
        Title        = "$legalServiceName Licenses and Rights Notice"
        Description  = "Static licenses and derivative-work rights notice for $legalServiceName."
        Lang         = "en"
        CanonicalUrl = "$publicOrigin/en/licenses/"
        Alternates   = $licensesAlternates
        DocType      = "Licenses"
    },
    @{
        MarkdownPath = Join-Path $localesRoot "ja\licenses.md"
        OutputPath   = Join-Path $staticRoot "ja\licenses\index.html"
        Title        = "$legalServiceName Licenses and Rights Notice"
        Description  = "Static licenses and derivative-work rights notice for $legalServiceName."
        Lang         = "ja"
        CanonicalUrl = "$publicOrigin/ja/licenses/"
        Alternates   = $licensesAlternates
        DocType      = "Licenses"
    }
)

foreach ($doc in $docs) {
    New-StaticLegalDoc @doc
}

function Remove-ObsoleteStaticOutputs {
    param([string[]]$RelativePaths)

    foreach ($relativePath in $RelativePaths) {
        $targetPath = Join-Path $staticRoot $relativePath
        if (Test-Path $targetPath) {
            Remove-Item -LiteralPath $targetPath -Force -Recurse
        }
    }
}

Remove-ObsoleteStaticOutputs -RelativePaths @(
    "terms.html",
    "terms-en.html",
    "terms-ja.html",
    "privacy.html",
    "privacy-en.html",
    "privacy-ja.html",
    "licenses.html",
    "licenses-en.html",
    "licenses-ja.html",
    "policy.html",
    "policy-en.html",
    "policy-ja.html",
    "terms",
    "privacy",
    "licenses",
    "policy",
    "faq",
    "welcome",
    "faq.html",
    "faq-en.html",
    "faq-ja.html",
    "welcome.html",
    "welcome-en.html",
    "welcome-ja.html",
    "ko\faq",
    "en\faq",
    "ja\faq",
    "ko\welcome",
    "en\welcome",
    "ja\welcome",
    "ko\policy",
    "en\policy",
    "ja\policy"
)

Write-BrandedTemplateFile `
    -TemplatePath $appTemplatePath `
    -OutputPath $appHtmlPath `
    -GeneratedComment "<!-- Generated from src/app.template.html by scripts/generate-static-legal-docs.ps1. -->"

Write-BrandedTemplateFile `
    -TemplatePath $offlineTemplatePath `
    -OutputPath $offlineHtmlPath `
    -GeneratedComment "<!-- Generated from static/offline.template.html by scripts/generate-static-legal-docs.ps1. -->"

Write-BrandedTemplateFile `
    -TemplatePath $manifestTemplatePath `
    -OutputPath $manifestPath

