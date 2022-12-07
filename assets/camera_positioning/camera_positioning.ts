import * as cc from "cc";
import { _decorator, Component, Node } from "cc";
import { camera_media, camera_media_ } from "./camera_media";
import tool_camera_positioning from "./tool_camera_positioning";

const { ccclass, property } = _decorator;
@ccclass("camera_positioning")
export class camera_positioning extends Component {
	/* --------------- 属性 --------------- */
	/** 定位图 */
	@property({ displayName: "定位图", type: cc.ImageAsset })
	image: cc.ImageAsset = null!;

	/** 摄像机媒体 */
	@property({ displayName: "摄像机媒体", type: camera_media })
	camera_media: camera_media = null!;
	/* --------------- private --------------- */
	/** 相机定位 */
	private _positioning!: tool_camera_positioning;
	/* ------------------------------- 生命周期 ------------------------------- */
	async onLoad() {
		this._init_data();
		this._init_view();
		this._init_event();
	}

	onDestroy() {}
	/* ------------------------------- 功能 ------------------------------- */
	/** 初始化事件 */
	private _init_event() {
		this.camera_media.event.on(
			this.camera_media.event.key.update_render,
			this._event_camera_update_render,
			this
		);
	}

	/** 初始化视图 */
	private _init_view(): void {}

	/** 初始化数据 */
	private _init_data(): void {
		this._positioning = new tool_camera_positioning({
			extractor: new cv.AKAZE(),
			img: this.image.data as any,
			matcher: new cv.BFMatcher(cv.NORM_HAMMING, true),
			knn_matcher: new cv.BFMatcher(),
			match_ratio: 0.7,
			draw_type_n: 0,
		});
		this._positioning.init();
	}
	/* ------------------------------- 自定义事件 ------------------------------- */
	private _event_camera_update_render(
		...event_as: Parameters<camera_media_.event["update_render"]>
	) {
		/** 纹理 */
		let texture = event_as[0];

		this._positioning.calculate(texture.image!.data as any);
	}
}
