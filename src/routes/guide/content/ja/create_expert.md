# エキスパートモード（Expert Mode）

出力形式とインタラクション挙動まで制御するためのモードです。

## コア構成

### 1. システムプロンプト
- 行動ルール、叙述トーン、禁止事項を定義
- `{{user}}`, `{{char}}` 変数を利用可能

### 2. Few-shot 例
- 複数例は `<START>` で区切る
- 話し方や語彙の一貫性を固定するのに最も有効

### 3. KB / RAG
- 世界観やルール文書を接続
- 長大な設定を1つのプロンプトに詰め込まず参照可能

### 4. パラメータ
- `temperature`, `top_p`, `top_k` などを調整

## カスタムプロンプトで必須の出力ルール

### セリフ出力
- セリフは `<dialogue speaker="{{char}}">...</dialogue>` を推奨
- 地の文（ナレーション）は `dialogue` タグの外に記述

### アセット画像出力
- `<img 0>`, `<img 1>` 形式を使用
- 画像タグは段落の間で単独行に配置

### 2DインタラクティブUI出力
- HTML/クラス規則を守らないと操作UIは機能しません
- 主なクラス:
  - `.game-choice-counter`
  - `.game-choice`（`data-id`, `data-action` 必須）
  - `.game-input`（`data-id` 推奨）
  - `.game-input-end`
- ユーザー操作結果は `<system-input>...</system-input>` として集約送信されます

### 占星術入力スニペット（コピペ用）
- 下記 `data-id` を使うと、占星術入力が自動でシステム入力に合成されます。
- 必須: `astro_date`, `astro_time`
- 地域名入力: `astro_place`（例: `Seoul`, `Tokyo`, `Busan`）
- 座標直接入力: `astro_lat`, `astro_lng` または `astro_location`（例: `37.5665,126.9780`）

```html
<div class="fortune-ui">
  <div class="game-choice-counter">1</div>
  <button class="game-choice" data-id="reading_mode" data-action="select-option" data-value="light">ライト鑑定</button>
  <button class="game-choice" data-id="reading_mode" data-action="select-option" data-value="deep">ディープ鑑定</button>
  <input class="game-input" data-id="topic" placeholder="相談テーマ（恋愛・仕事・人間関係）" />
  <input class="game-input" data-id="astro_date" placeholder="生年月日 (YYYY-MM-DD)" />
  <input class="game-input" data-id="astro_time" placeholder="出生時刻 (HH:mm)" />
  <input class="game-input" data-id="astro_place" placeholder="地域名 (例: Seoul, Tokyo, Busan)" />
  <input class="game-input" data-id="astro_location" placeholder="緯度,経度 (例: 37.5665,126.9780)" />
  <button class="game-input-end">占星術分析を開始</button>
</div>
```

### 変数システム（2D）
- ランタイム状態を更新する場合、返信に `<vars>...</vars>` を含めます
- ブロック内部は1行ごとに `key=value` 形式
- 例:
  - `<vars>`
  - `trust=12`
  - `danger=3`
  - `</vars>`
- `<vars>` は表示本文ではなく状態データで、状態UIと次ターン推論に使われます

## 実運用のコツ

- Kintsugi テンプレートにはインタラクティブ規則が含まれています。
- 完全カスタムでは上記規則を明示する方が安定します。
- ボタン操作 + 入力 + 終了ボタンまで最低1サイクルはテストしてください。
