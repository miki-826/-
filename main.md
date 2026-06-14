いいです。
**「ドッペルマスター」**は名前としてかなり強いです。

方向性はこれで固めるのが良いです。

# 要件定義書：ドッペルマスター

## 1. アプリ概要

| 項目    | 内容                                             |
| ----- | ---------------------------------------------- |
| アプリ名  | **ドッペルマスター**                                   |
| ジャンル  | AI声マネ採点ゲーム                                     |
| テーマ   | 声                                              |
| プレイ時間 | 1プレイ 1〜2分                                      |
| 対応端末  | PC / スマホ                                       |
| 実装方針  | GitHubにpush → Vercelで自動デプロイ                    |
| 使用技術  | Vercel / Supabase / OpenAI API / Web Audio API |
| 主要体験  | AIの声を聞き、人間が真似して、AIが似ている度を採点する                  |

---

## 2. コンセプト

**AIが出すランダムな声を、人間がどこまで真似できるかを競う体験型アプリ。**

プレイヤーはAIが生成した「お題ボイス」を聞き、同じセリフ・同じ感情・同じ雰囲気で読み上げる。
その音声をAIが分析し、**セリフ一致度・感情一致度・話速一致度・抑揚一致度・キャラ再現度**を採点する。

結果はレーダーチャートで表示し、ランキングに登録できる。

一言でいうと、

> **AI版ものまねカラオケ採点ゲーム**

です。

---

## 3. ユーザー体験

## 基本フロー

```text
タイトル画面
 ↓
お題生成
 ↓
AIお手本ボイス再生
 ↓
ユーザーが音声入力・録音
 ↓
AI採点
 ↓
レーダーチャート表示
 ↓
ランキング登録
 ↓
もう一度プレイ / タイトルへ
```

---

# 4. 画面要件

## 4.1 タイトル画面

### 表示内容

* アプリ名：**ドッペルマスター**
* サブコピー：
  **AIの声を聞いて、どこまで真似できるか。**
* スタートボタン
* ランキングボタン
* 遊び方ボタン

### UIイメージ

```text
DOPPEL MASTER
ドッペルマスター

AIの声を聞いて、
もう一人の声を演じろ。

[ スタート ]
[ ランキング ]
[ 遊び方 ]
```

### デザイン方針

* カラオケ採点画面風
* ネオン / ステージ / 音声波形
* 黒・紫・シアン・白を基調
* ゲームセンター感を少し入れる

---

## 4.2 遊び方画面

### 表示内容

```text
1. AIのお手本ボイスを聞く
2. 同じセリフをできるだけ似せて読む
3. AIが声マネ度を採点
4. レーダーチャートで結果を確認
5. 高得点ならランキング入り！
```

### 注意書き

```text
このアプリは声マネ採点ゲームです。
他人の声を無断で録音・使用しないでください。
録音データは採点のためだけに使用します。
```

---

## 4.3 お題生成画面

### 機能

AIがランダムで以下を生成する。

| 項目     | 内容                         |
| ------ | -------------------------- |
| キャラクター | 例：疲れたコンビニ店員                |
| セリフ    | 例：ありがとうございました。またお越しくださいませ。 |
| 感情     | 例：疲労、眠気、諦め                 |
| 話し方    | 例：テンション低め、語尾が弱い、少し早口       |
| 難易度    | EASY / NORMAL / HARD       |

### お題例

```text
キャラ：疲れ切ったコンビニ店員
セリフ：ありがとうございました。またお越しくださいませ。
感情：疲労
話し方：テンション低め、語尾が消えそう、少し早口
難易度：NORMAL
```

### ボタン

* お手本を聞く
* もう一度お題を作る
* 録音へ進む

---

## 4.4 お手本ボイス再生画面

### 表示内容

* キャラクター名
* セリフ
* 話し方のヒント
* 再生ボタン
* 波形アニメーション

### 実装方針

お手本音声は、まずは以下のどちらかで実装。

| 優先度 | 方法                   | 理由              |
| --- | -------------------- | --------------- |
| 高   | Web Speech API の読み上げ | 速い・無料・実装が軽い     |
| 中   | OpenAI TTS           | 声の品質が高いがAPI費用あり |

MVPでは **Web Speech APIの読み上げ** で十分です。
MDNではWeb Speech APIは音声認識と音声合成を扱うAPIとして説明されています。音声認識の `SpeechRecognition` はブラウザ対応が限定的なので、対応ブラウザの前提表示は入れた方が安全です。([MDN Web Docs][1])

---

## 4.5 録音・音声入力画面

### 必須機能

* マイク許可
* 録音開始
* 録音停止
* 録音再生
* 再録音
* 採点する
* 音声認識による文字起こし

### 表示内容

```text
お手本を真似して読んでください

「ありがとうございました。またお越しくださいませ。」

[ 録音開始 ]
[ 録音停止 ]
[ 自分の声を聞く ]
[ 採点する ]
```

### 技術方針

録音には `MediaRecorder API` を使う。MDNでは、MediaRecorderはMediaStream Recording APIのインターフェイスで、メディアを簡単に録音するための機能として説明されています。([MDN Web Docs][2])

音声入力・文字起こしは、MVPでは以下の優先順位。

| 優先度 | 方法                    | 内容           |
| --- | --------------------- | ------------ |
| 1   | Web Speech API        | ブラウザで音声認識    |
| 2   | OpenAI Speech-to-Text | 精度重視。API費用あり |
| 3   | 手入力フォールバック            | 音声認識が動かない場合用 |

`SpeechRecognition` はブラウザによって対応差があり、Chromeなど一部ではサーバーベースの認識エンジンが使われる点もあるため、デモ環境はChrome推奨にするのが良いです。([MDN Web Docs][3])

---

# 5. 採点要件

## 5.1 採点項目

| 項目     |    点数 | 内容                      |
| ------ | ----: | ----------------------- |
| セリフ一致度 | 0〜100 | お題セリフと文字起こしがどれだけ一致しているか |
| 感情一致度  | 0〜100 | 指定された感情を再現できているか        |
| 話速一致度  | 0〜100 | お手本の想定秒数と録音秒数が近いか       |
| 抑揚一致度  | 0〜100 | 声の上がり下がり・強弱の再現度         |
| キャラ再現度 | 0〜100 | キャラクターらしさが出ているか         |
| 総合スコア  | 0〜100 | 上記の総合評価                 |

---

## 5.2 採点ロジック

3時間ハッカソンでは、音声解析を全部ガチでやるより、次の組み合わせが現実的です。

### 採点に使うデータ

| データ       | 取得方法          | 採点への使い方          |
| --------- | ------------- | ---------------- |
| お題セリフ     | AI生成          | 正解データ            |
| ユーザー文字起こし | 音声認識          | セリフ一致度           |
| 録音秒数      | MediaRecorder | 話速一致度            |
| 平均音量      | Web Audio API | 感情・迫力の参考         |
| 音量変化      | Web Audio API | 抑揚の参考            |
| AI評価      | ChatGPT API   | 感情・キャラ再現度のコメント生成 |

---

## 5.3 MVP版の採点式

### セリフ一致度

文字列類似度で算出。

```text
お題セリフとユーザー文字起こしの近さを0〜100で計算
```

### 話速一致度

```text
100 - abs(お手本想定秒数 - ユーザー録音秒数) × 15
```

最低0点、最高100点。

### 抑揚一致度

MVPでは簡易的に、

```text
録音中の音量変化が大きいほど抑揚がある
```

として計算。

### 感情一致度・キャラ再現度

ChatGPT APIに以下を渡して採点。

* お題キャラ
* 感情
* 話し方
* セリフ
* ユーザー文字起こし
* 録音秒数
* 平均音量
* 音量変化
* セリフ一致度
* 話速一致度
* 抑揚一致度

---

# 6. 結果画面要件

## 表示内容

* 総合スコア
* 称号
* レーダーチャート
* AIコメント
* 良かった点
* 改善点
* ランキング登録欄

### 結果例

```text
総合スコア：86点

称号：
限界コンビニ店員マスター

AIコメント：
語尾の弱さとテンションの低さがかなり近かったです。
ただし、お手本より少し早口でした。
次は語尾をもう少し伸ばすと、さらに似ます。
```

---

## レーダーチャート項目

```text
セリフ一致度
感情一致度
話速一致度
抑揚一致度
キャラ再現度
```

### 使用ライブラリ

```bash
npm install recharts
```

`RadarChart` を使う。

---

# 7. ランキング要件

## 7.1 ランキング仕様

| 項目      | 内容                             |
| ------- | ------------------------------ |
| 登録タイミング | 結果画面                           |
| 登録名     | プレイヤー名                         |
| 保存内容    | スコア、各採点項目、お題、称号                |
| 表示件数    | 上位10件                          |
| 並び順     | 総合スコア降順                        |
| 同点の場合   | 作成日時が早い順、または新しい順               |
| 認証      | MVPではなし                        |
| 不正対策    | 名前20文字以内、スコアはサーバー側で再計算できる設計が理想 |

---

## 7.2 ランキング画面

### 表示内容

```text
RANKING

1位  みき        96点  魔王ボイス完全体
2位  player01   91点  眠れるナレーター
3位  guest      88点  限界コンビニ店員
```

### フィルター

MVPでは不要。
余裕があれば追加。

* 今日のランキング
* 総合ランキング
* 難易度別ランキング

---

# 8. Supabase設計

SupabaseはPostgresベースの開発プラットフォームで、Database・Auth・Storage・Realtimeなどを提供しています。今回のMVPではDatabaseをランキング保存に使います。([Supabase][4])

## 8.1 テーブル：scores

```sql
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  total_score int not null check (total_score >= 0 and total_score <= 100),

  script_match int not null check (script_match >= 0 and script_match <= 100),
  emotion_match int not null check (emotion_match >= 0 and emotion_match <= 100),
  speed_match int not null check (speed_match >= 0 and speed_match <= 100),
  intonation_match int not null check (intonation_match >= 0 and intonation_match <= 100),
  character_match int not null check (character_match >= 0 and character_match <= 100),

  title text not null,
  character_name text not null,
  script text not null,
  voice_style text not null,
  difficulty text not null default 'NORMAL',

  created_at timestamptz not null default now()
);
```

---

## 8.2 RLS設定

MVPでは以下がシンプルです。

```sql
alter table public.scores enable row level security;

create policy "Anyone can read scores"
on public.scores
for select
using (true);

create policy "Anyone can insert scores"
on public.scores
for insert
with check (
  char_length(player_name) <= 20
  and total_score between 0 and 100
  and script_match between 0 and 100
  and emotion_match between 0 and 100
  and speed_match between 0 and 100
  and intonation_match between 0 and 100
  and character_match between 0 and 100
);
```

---

## 8.3 Supabase操作

Supabase JSでは `insert()` でレコード追加ができます。挿入した行を返したい場合は `.select()` をつなげる必要があります。([Supabase][5])

ランキング取得は、`order()` と `limit()` を使う構成にします。Supabase JSの `order()` は指定カラムで並び替え、`limit()` は取得件数を制限するためのメソッドです。([Supabase][6])

### 登録例

```ts
await supabase.from("scores").insert({
  player_name: playerName,
  total_score: result.totalScore,
  script_match: result.scriptMatch,
  emotion_match: result.emotionMatch,
  speed_match: result.speedMatch,
  intonation_match: result.intonationMatch,
  character_match: result.characterMatch,
  title: result.title,
  character_name: challenge.character,
  script: challenge.script,
  voice_style: challenge.voiceStyle,
  difficulty: challenge.difficulty,
});
```

### ランキング取得例

```ts
const { data, error } = await supabase
  .from("scores")
  .select("*")
  .order("total_score", { ascending: false })
  .order("created_at", { ascending: false })
  .limit(10);
```

---

# 9. OpenAI API設計

## 9.1 お題生成API

### `/api/generate-challenge`

役割：

* ランダムなお題を生成する
* キャラ、セリフ、感情、話し方、難易度を返す

### 出力JSON

```json
{
  "character": "疲れ切ったコンビニ店員",
  "script": "ありがとうございました。またお越しくださいませ。",
  "emotion": "疲労",
  "voiceStyle": "テンション低め、語尾が消えそう、少し早口",
  "difficulty": "NORMAL",
  "targetDuration": 4.5
}
```

---

## 9.2 採点API

### `/api/score`

役割：

* ユーザーの録音結果を採点する
* JSONで採点結果を返す

### 入力

```json
{
  "challenge": {
    "character": "疲れ切ったコンビニ店員",
    "script": "ありがとうございました。またお越しくださいませ。",
    "emotion": "疲労",
    "voiceStyle": "テンション低め、語尾が消えそう、少し早口",
    "difficulty": "NORMAL",
    "targetDuration": 4.5
  },
  "userTranscript": "ありがとうございました。またお越しくださいませ。",
  "audioFeatures": {
    "duration": 4.8,
    "averageVolume": 0.62,
    "volumeVariance": 0.31,
    "silenceRatio": 0.12
  },
  "computedScores": {
    "scriptMatch": 96,
    "speedMatch": 94,
    "intonationMatch": 78
  }
}
```

### 出力

```json
{
  "scriptMatch": 96,
  "emotionMatch": 82,
  "speedMatch": 94,
  "intonationMatch": 78,
  "characterMatch": 88,
  "totalScore": 88,
  "title": "限界コンビニ店員マスター",
  "goodPoint": "語尾の力の抜け方がかなり近かったです。",
  "improvement": "次はもう少し声のトーンを落とすと、さらに疲れた雰囲気が出ます。",
  "comment": "全体的に再現度が高く、キャラクターの雰囲気もよく出ていました。"
}
```

---

## 9.3 採点プロンプト

```text
あなたは「ドッペルマスター」というAI声マネ採点ゲームの審査員です。

ユーザーはAIのお手本ボイスを真似して、同じセリフを読みました。
以下の情報をもとに、声マネの再現度を採点してください。

重要：
- 実在人物の声真似や本人確認には使わない
- あくまでゲーム内のお題キャラクターの再現度として採点する
- ユーザーを傷つける表現は避ける
- コメントは短く、ゲームらしく、少し褒める

お題：
キャラクター: {{character}}
セリフ: {{script}}
感情: {{emotion}}
話し方: {{voiceStyle}}
難易度: {{difficulty}}
目標秒数: {{targetDuration}}

ユーザーの文字起こし:
{{userTranscript}}

音声特徴量:
録音秒数: {{duration}}
平均音量: {{averageVolume}}
音量変化: {{volumeVariance}}
無音率: {{silenceRatio}}

事前計算スコア:
セリフ一致度: {{scriptMatch}}
話速一致度: {{speedMatch}}
抑揚一致度: {{intonationMatch}}

以下のJSONだけを返してください。

{
  "scriptMatch": 0-100,
  "emotionMatch": 0-100,
  "speedMatch": 0-100,
  "intonationMatch": 0-100,
  "characterMatch": 0-100,
  "totalScore": 0-100,
  "title": "称号",
  "goodPoint": "良かった点",
  "improvement": "改善点",
  "comment": "総評"
}
```

---

# 10. 推奨ディレクトリ構成

Next.js App Router想定。

```text
doppel-master/
├─ app/
│  ├─ page.tsx
│  ├─ play/
│  │  └─ page.tsx
│  ├─ result/
│  │  └─ page.tsx
│  ├─ ranking/
│  │  └─ page.tsx
│  ├─ api/
│  │  ├─ generate-challenge/
│  │  │  └─ route.ts
│  │  └─ score/
│  │     └─ route.ts
│  └─ globals.css
├─ components/
│  ├─ ChallengeCard.tsx
│  ├─ VoiceRecorder.tsx
│  ├─ ScoreRadarChart.tsx
│  ├─ RankingTable.tsx
│  └─ WaveVisualizer.tsx
├─ lib/
│  ├─ supabaseClient.ts
│  ├─ scoring.ts
│  ├─ speech.ts
│  └─ audioFeatures.ts
├─ types/
│  └─ index.ts
├─ .env.local
├─ package.json
└─ README.md
```

---

# 11. 環境変数

## `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

Vercelにも同じ環境変数を登録します。

---

# 12. GitHub → Vercel 運用要件

VercelはGitHub連携に対応しており、GitHubプロジェクトを接続すると、ブランチへのpushや本番ブランチへのmergeに応じた自動デプロイができます。([Vercel][7])

## 開発フロー

```text
ローカルで作成
 ↓
GitHubリポジトリ作成
 ↓
git init
 ↓
git add .
 ↓
git commit
 ↓
git push
 ↓
VercelでGitHubリポジトリをImport
 ↓
環境変数を設定
 ↓
Deploy
```

## コマンド例

```bash
npx create-next-app@latest doppel-master
cd doppel-master

npm install @supabase/supabase-js recharts

git init
git add .
git commit -m "initial commit: doppel master"
git branch -M main
git remote add origin https://github.com/<your-name>/doppel-master.git
git push -u origin main
```

---

# 13. MVP実装優先順位

## Phase 1：最低限動く版

まずここまで作れば、ハッカソン提出可能です。

| 優先度 | 機能       | 内容                          |
| --: | -------- | --------------------------- |
|   1 | タイトル画面   | スタート・ランキング                  |
|   2 | お題生成     | 固定配列 or OpenAI生成            |
|   3 | お手本読み上げ  | Web Speech API              |
|   4 | 録音       | MediaRecorder               |
|   5 | 音声入力     | SpeechRecognition           |
|   6 | 採点       | 文字起こし＋録音秒数＋AI               |
|   7 | 結果画面     | 点数・コメント                     |
|   8 | レーダーチャート | Recharts                    |
|   9 | ランキング登録  | Supabase insert             |
|  10 | ランキング表示  | Supabase select/order/limit |

---

## Phase 2：見た目強化

| 機能        | 内容        |
| --------- | --------- |
| 波形アニメーション | 録音中に動く    |
| 採点中演出     | 解析ログを表示   |
| 称号演出      | スコアに応じた称号 |
| スコア効果音    | 高得点時に演出   |
| SNS共有画像   | 結果カードを画像化 |

---

## Phase 3：余裕があれば

| 機能         | 内容                   |
| ---------- | -------------------- |
| 難易度選択      | EASY / NORMAL / HARD |
| 対戦モード      | 2人で同じお題              |
| 日別ランキング    | 今日の声マネ王              |
| 録音アップロード   | Supabase Storage     |
| OpenAI TTS | 高品質お手本音声             |

---

# 14. 重要な仕様判断

## 音声データは保存しない

MVPでは録音音声をSupabaseに保存しない方が安全です。

保存するのは以下だけ。

* プレイヤー名
* スコア
* お題
* 採点結果
* 称号
* 作成日時

録音音声はブラウザ内で採点後に破棄する。

これならプライバシー面の説明がしやすいです。

---

## ランキングに保存するのはスコアのみ

音声を保存しないことで、

> 声を使うアプリだけど、声そのものは保存しません

と言えるため、審査でも安心感があります。

---

## 音声認識が失敗した場合

フォールバックを用意します。

```text
音声認識に失敗しました。
読んだ内容をテキストで入力してください。
```

これで本番デモ時の事故を減らせます。

---

# 15. お題データ例

OpenAI生成が失敗した時用に、固定お題も持っておくべきです。

```ts
export const fallbackChallenges = [
  {
    character: "疲れ切ったコンビニ店員",
    script: "ありがとうございました。またお越しくださいませ。",
    emotion: "疲労",
    voiceStyle: "テンション低め、語尾が消えそう、少し早口",
    difficulty: "NORMAL",
    targetDuration: 4.5,
  },
  {
    character: "魔王みたいな上司",
    script: "この資料、明日の朝までに頼むぞ。",
    emotion: "圧力",
    voiceStyle: "低い声、ゆっくり、威圧感がある",
    difficulty: "HARD",
    targetDuration: 4.0,
  },
  {
    character: "泣きそうなAIロボット",
    script: "僕は、まだここにいてもいいの？",
    emotion: "不安",
    voiceStyle: "弱々しい、語尾が震える、少し間を空ける",
    difficulty: "NORMAL",
    targetDuration: 4.2,
  },
  {
    character: "テンション高いゲーム実況者",
    script: "ここでまさかの大逆転だー！",
    emotion: "興奮",
    voiceStyle: "大きな声、早口、語尾を伸ばす",
    difficulty: "EASY",
    targetDuration: 3.2,
  },
  {
    character: "寝起きのニュースキャスター",
    script: "本日の天気は、全国的に晴れとなるでしょう。",
    emotion: "眠気",
    voiceStyle: "落ち着いた声、少し眠そう、一定のテンポ",
    difficulty: "NORMAL",
    targetDuration: 5.0,
  },
];
```

---

# 16. スコア称号

```text
95〜100：完全ドッペルマスター
90〜94：声マネの支配者
80〜89：かなり似てる演者
70〜79：雰囲気コピー職人
60〜69：惜しい声マネ師
50〜59：方向性は合ってる人
0〜49：別人格爆誕
```

---

# 17. 審査員向け説明文

```text
ドッペルマスターは、AIが生成したランダムなお題ボイスを人間が真似し、その再現度をAIが採点する体験型アプリです。

ユーザーはAIのお手本音声を聞き、同じセリフをマイクで読み上げます。
アプリは文字起こし、録音時間、音量変化などをもとに、セリフ一致度・感情一致度・話速一致度・抑揚一致度・キャラ再現度を算出します。

結果はレーダーチャートで可視化され、スコアはSupabaseに保存されてランキング化されます。

声を「入力」ではなく「遊びの対象」にした、AI版ものまねカラオケ採点ゲームです。
```

---

# 18. 最終MVP仕様まとめ

## 作るべきもの

**ドッペルマスター**
AIの声を真似して、どれだけ似ているかを競うランキング付きWebアプリ。

## 必須機能

* ランダムお題生成
* AIお手本音声再生
* ユーザー音声録音
* 音声入力・文字起こし
* AI採点
* レーダーチャート
* Supabaseランキング
* GitHub push後、Vercelデプロイ

## 実装で守ること

* GitHubに一度pushしてからVercelに接続
* 環境変数はVercel側に登録
* Supabaseにはランキングデータのみ保存
* 音声データは保存しない
* 音声認識失敗時は手入力フォールバック
* ランキングは上位10件表示

---

# 結論

**ドッペルマスターは、ハッカソン向きとしてかなり強いです。**

特に良いのは、

* お題「声」を真正面から使っている
* 会場で遊ばせやすい
* AIの必要性が分かりやすい
* レーダーチャートで見た目が映える
* ランキングで盛り上がる
* Vercel + Supabase構成に綺麗に収まる

という点です。

3時間で勝ちに行くなら、
**音声保存なし・Web Speech API読み上げ・MediaRecorder録音・Supabaseランキング**でMVPを作るのが一番現実的です。

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API?utm_source=chatgpt.com "Web Speech API - MDN Web Docs - Mozilla"
[2]: https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder?utm_source=chatgpt.com "MediaRecorder - Web API | MDN"
[3]: https://developer.mozilla.org/ja/docs/Web/API/SpeechRecognition?utm_source=chatgpt.com "SpeechRecognition - Web API | MDN"
[4]: https://supabase.com/?utm_source=chatgpt.com "Supabase | The Postgres Development Platform."
[5]: https://supabase.com/docs/reference/javascript/insert?utm_source=chatgpt.com "JavaScript: Insert data | Supabase Docs"
[6]: https://supabase.com/docs/reference/javascript/order?utm_source=chatgpt.com "JavaScript: Order the results | Supabase Docs"
[7]: https://vercel.com/docs/git/vercel-for-github?utm_source=chatgpt.com "Deploying GitHub Projects with Vercel"
