export type SfxName =
  | "click"
  | "select"
  | "start"
  | "record-start"
  | "record-stop"
  | "analyze"
  | "success"
  | "highscore"
  | "error"
  | "whoosh";

export type BgmName = "title" | "scoring";

const BGM_SRC: Record<BgmName, string> = {
  title: "/bgm/title.mp3",
  scoring: "/bgm/scoring.mp3",
};

/**
 * BGMと効果音をまとめて管理するシングルトン。
 * お手本再生中・録音中はBGMを止める用途で stopBgm() を使う。
 */
class SoundManager {
  private bgm: HTMLAudioElement | null = null;
  private current: BgmName | null = null;
  private sfxCache = new Map<SfxName, HTMLAudioElement>();
  private _muted = false;
  private bgmVolume = 0.45;

  get muted() {
    return this._muted;
  }

  private ensureBgm() {
    if (typeof Audio === "undefined") return null;
    if (!this.bgm) {
      this.bgm = new Audio();
      this.bgm.loop = true;
      this.bgm.volume = this.bgmVolume;
    }
    return this.bgm;
  }

  playBgm(name: BgmName) {
    const el = this.ensureBgm();
    if (!el) return;
    if (this.current !== name) {
      el.src = BGM_SRC[name];
      this.current = name;
    }
    el.loop = true;
    el.volume = this._muted ? 0 : this.bgmVolume;
    el.play().catch(() => {});
  }

  /** お手本再生・録音中などBGMを一時停止したい時に使う */
  stopBgm() {
    if (this.bgm) {
      this.bgm.pause();
    }
  }

  /** 直近のBGMを再開する */
  resumeBgm(name?: BgmName) {
    if (name) {
      this.playBgm(name);
      return;
    }
    if (this.bgm && this.current) {
      this.bgm.volume = this._muted ? 0 : this.bgmVolume;
      this.bgm.play().catch(() => {});
    }
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (this.bgm) this.bgm.volume = this._muted ? 0 : this.bgmVolume;
    return this._muted;
  }

  playSfx(name: SfxName, volume = 0.7) {
    if (this._muted || typeof Audio === "undefined") return;
    let base = this.sfxCache.get(name);
    if (!base) {
      base = new Audio(`/sfx/${name}.mp3`);
      this.sfxCache.set(name, base);
    }
    // 連打対応のため複製して再生
    const clone = base.cloneNode(true) as HTMLAudioElement;
    clone.volume = volume;
    clone.play().catch(() => {});
  }
}

export const sound = new SoundManager();
