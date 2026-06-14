# ドッペルマスター

AI声マネ採点ゲーム。AIが出すお手本ボイスを聞き、同じセリフをどこまで真似できるかをAIが採点する体験型Webアプリです。

> AIの声を聞いて、もう一人の声を演じろ。

## 特徴

- **お題生成** … キャラ・セリフ・感情・話し方・難易度をランダムに出題
- **お手本再生** … Web Speech API で話し方に合わせた読み上げ（再生中はBGM停止）
- **録音 + 波形表示** … MediaRecorder で録音し、声の波形を表示（録音中はBGM停止）
- **採点** … 録音音声の特徴量（長さ・音量・音量変化・無音率）だけで採点。文字起こしは行いません
- **レーダーチャート + 波形** … 結果を5項目で可視化（SVG実装）し、声の波形も表示
- **音量調整** … 画面右上のスライダーでBGM・効果音の音量をまとめて変更
- **ランキング** … 上位10件を表示（既定はlocalStorage。Supabase設定時はクラウド保存。音声は保存しません）

## 使用アセット

- 背景・タイトル・ボタン・採点用数字画像（`public/images/`）
- BGM：タイトル画面・採点（`public/bgm/`）
- 効果音：[Mixkit](https://mixkit.co/free-sound-effects/) の著作権フリー音源（`public/sfx/`）

## サウンド仕様

- タイトル／お題／結果画面：各BGMを再生
- **お手本再生中・録音中はBGMを停止**（声に集中できるように）
- ボタン操作・録音開始/停止・採点演出などの効果音は Mixkit の無料SFXを使用

## 技術スタック

- Next.js 14 (App Router) / React 18 / TypeScript
- Web Speech API（読み上げ）
- MediaRecorder API / Web Audio API（録音・波形・音量解析）

採点は OpenAI API キーなしで動くローカル実装です（Chrome 推奨）。

## 開発

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 本番ビルド
```

## デプロイ（Vercel）

環境変数なしでもそのまま動きます（ランキングは各ブラウザの localStorage 保存）。

1. このリポジトリを GitHub に push
2. [Vercel](https://vercel.com/) で **New Project → Import** からリポジトリを選択
3. Framework は **Next.js** が自動検出される。そのまま **Deploy**
4. （任意）Supabase / OpenAI を使う場合は次項の環境変数を **Settings → Environment Variables** に登録して再デプロイ

`git push` するたびに Vercel が自動で再デプロイします。

## Supabase でランキングをクラウド共有する（任意）

未設定なら localStorage で動作します。全プレイヤーでランキングを共有したい場合のみ設定します。

### 1. プロジェクトとテーブルを作成

[Supabase](https://supabase.com/) でプロジェクトを作成し、**SQL Editor** で以下を実行します。

```sql
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  total_score int not null check (total_score between 0 and 100),
  script_match int not null check (script_match between 0 and 100),
  emotion_match int not null check (emotion_match between 0 and 100),
  speed_match int not null check (speed_match between 0 and 100),
  intonation_match int not null check (intonation_match between 0 and 100),
  character_match int not null check (character_match between 0 and 100),
  title text not null,
  character_name text not null,
  script text not null,
  voice_style text not null,
  difficulty text not null default 'NORMAL',
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;

create policy "Anyone can read scores"
  on public.scores for select using (true);

create policy "Anyone can insert scores"
  on public.scores for insert with check (
    char_length(player_name) <= 20
    and total_score between 0 and 100
  );
```

### 2. 環境変数を設定

`.env.example` を `.env.local` にコピーし、Supabase の **Project Settings → API** から値を貼り付けます。Vercel にも同じ変数を登録します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

設定後はランキングの登録・取得が Supabase の REST API 経由になります（`lib/ranking.ts`）。
追加ライブラリのインストールは不要で、`anon` キーは公開前提の RLS で保護されています。

## OpenAI でお題生成・採点コメントを強化する（任意）

MVP は固定お題＋ローカル採点で完結しています。OpenAI を使う場合は `OPENAI_API_KEY` を
**サーバー側の環境変数**（`NEXT_PUBLIC_` を付けない）として Vercel に登録し、
`app/api/generate-challenge/route.ts` などの API Route から呼び出す構成に拡張できます
（キーはクライアントに露出させないこと）。

## プライバシー

録音音声はブラウザ内で採点に使ったあと破棄され、サーバーには送信・保存しません。保存されるのはプレイヤー名・スコア・お題・称号などのテキストのみです。
