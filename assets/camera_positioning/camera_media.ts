import * as cc from "cc";
import { _decorator, Component, Node } from "cc";
import { JSB } from "cc/env";
import safe_event from "../@framework/safe_event";

/** 摄像机媒体 */
const { ccclass, property } = _decorator;
@ccclass("camera_media")
export class camera_media extends Component {
	/* --------------- 属性 --------------- */
	@property({ displayName: "测试视频", type: cc.VideoClip })
	test_video: cc.VideoClip = null!;
	/* --------------- public --------------- */
	event = new safe_event<camera_media_.event>();
	/* --------------- private --------------- */
	/** 初始化状态 */
	private _init_b = false;
	/** 画布（视频 -> 画布 -> 图片） */
	private _h5_canvas!: HTMLCanvasElement;
	/** 视频（摄像机输出） */
	private _h5_video!: HTMLVideoElement;
	/** 摄像机图片资源 */
	private _image = new cc.ImageAsset();
	/** 输出精灵 */
	private _sprite!: cc.Sprite;
	/* ------------------------------- 生命周期 ------------------------------- */
	onLoad() {
		this._init_data();
	}
	/* ------------------------------- 功能 ------------------------------- */
	/** 初始化数据 */
	private async _init_data(): Promise<void> {
		this._sprite = this.node.sprite;
		// Element
		this._h5_canvas = document.createElement("canvas");
		this._h5_video = document.createElement("video");
		// Element 属性（IOS）
		this._h5_video.setAttribute("autoplay", "");
		this._h5_video.setAttribute("muted", "");
		this._h5_video.setAttribute("playsinline", "");
		// 播放回调
		this._h5_video.onplay = () => {
			// SpriteFrame
			this._sprite.spriteFrame = new cc.SpriteFrame();
			this._update_camera_render();
			// 更新摄像机纹理
			this.schedule(this._update_camera_render, 1 / 60);

			this._init_b = true;
		};
		// 播放测试视频
		if (this.test_video) {
			// 等待点击
			this.node.children[0].active = true;
			await new Promise<void>((resolve_f) => {
				this.node.once(cc.Node.EventType.TOUCH_END, resolve_f, this);
			});
			this.node.children[0].active = false;
			// 准备播放
			this._h5_video.src = this.test_video.nativeUrl;
			await new Promise<void>((resolve_f) => {
				this._h5_video.oncanplay = () => {
					resolve_f();
				};
			});
			this._h5_video.oncanplay = null;
			// 输出尺寸
			this.node.width = this._h5_canvas.width = this._h5_video.videoWidth;
			this.node.height = this._h5_canvas.height = this._h5_video.videoHeight;
			// 开始播放
			this._h5_video.play();
			return;
		}
		// 摄像机媒体
		{
			// 输出尺寸
			this._h5_canvas.width = this._h5_video.width = this.node.width;
			this._h5_canvas.height = this._h5_video.height = this.node.height;
			/** 纵横比 */
			let aspect = this.node.width / this.node.height;
			if (JSB) {
				aspect = 1 / aspect;
			}
			self.navigator.mediaDevices
				.getUserMedia({
					video: {
						width: {
							ideal: this.node.width,
						},
						height: {
							ideal: this.node.height,
						},
						aspectRatio: {
							ideal: aspect,
						},
						facingMode: "environment",
					},
				})
				.then(async (stream) => {
					this._h5_video.srcObject = stream;
					this._h5_video.play();
				})
				.catch((error) => {
					console.error("相机初始化失败", error.code, error.message, error);
				});
		}
	}

	/** 更新摄像机渲染 */
	private _update_camera_render(): void {
		// video 转 canvas
		this._h5_canvas
			.getContext("2d")!
			.drawImage(this._h5_video, 0, 0, this._h5_canvas.width, this._h5_canvas.height);
		// canvas 转 image
		let new_texture = new cc.Texture2D();
		this._image.reset(this._h5_canvas);
		new_texture.image = this._image;
		// 更新纹理
		this._sprite.spriteFrame!.texture?.decRef();
		this._sprite.spriteFrame!.texture = new_texture;
		this._sprite.markForUpdateRenderData();
		// 事件通知
		if (this._init_b) {
			this.event.emit(this.event.key.update_render, new_texture);
		}
	}
}

export namespace camera_media_ {
	/** 组件事件 */
	export interface event {
		/** 更新渲染 */
		update_render: (texture: cc.Texture2D) => void;
	}
}
