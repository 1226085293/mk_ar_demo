import * as cc from "cc";
import { _decorator, Component, Node } from "cc";

const { ccclass, property } = _decorator;
@ccclass("webcam")
export class webcam extends Component {
	/* --------------- 属性 --------------- */
	/** 摄像机输出 */
	@property({ displayName: "摄像机输出", type: cc.Sprite })
	camera_sprite: cc.Sprite = null!;
	/* --------------- private --------------- */
	/** 初始化状态 */
	private _init_b = false;
	private _h5_canvas!: HTMLCanvasElement;
	private _h5_video!: HTMLVideoElement;
	private _image = new cc.ImageAsset();
	private _spriteFrame = new cc.SpriteFrame();
	/* ------------------------------- 生命周期 ------------------------------- */
	async onLoad() {
		this._h5_canvas = document.createElement("canvas");
		this._h5_video = document.createElement("video");

		this._h5_video.setAttribute("autoplay", "");
		this._h5_video.setAttribute("muted", "");
		this._h5_video.setAttribute("playsinline", "");

		this._h5_canvas.width = this._h5_video.width = 960;
		this._h5_canvas.height = this._h5_video.height = 640;

		self.navigator.mediaDevices
			.getUserMedia({
				video: {
					facingMode: "environment",
				},
			})
			.then(async (stream) => {
				this._h5_video.srcObject = stream;
				this._h5_video.play();
				this.camera_sprite.spriteFrame = this._spriteFrame;
				this._init_b = true;
			})
			.catch((error) => {
				console.log(error.code, error.message, error);
			});
	}

	update() {
		if (!this._init_b) {
			return;
		}
		this.updateTexture();
	}
	/* ------------------------------- 功能 ------------------------------- */
	updateTexture() {
		/** 绘制到 canvas */
		this._h5_canvas
			.getContext("2d")!
			.drawImage(this._h5_video, 0, 0, this._h5_canvas.width, this._h5_canvas.height);
		let new_texture = new cc.Texture2D();
		this._image.reset(this._h5_canvas);
		new_texture.image = this._image;
		this.camera_sprite.spriteFrame!.texture?.decRef();
		this.camera_sprite.spriteFrame!.texture = new_texture;
		this.camera_sprite.markForUpdateRenderData();
	}
}
