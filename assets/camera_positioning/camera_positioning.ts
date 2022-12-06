import * as cc from "cc";
import { _decorator, Component, Node } from "cc";
import tool_camera_positioning from "./tool_camera_positioning";

const { ccclass, property } = _decorator;
@ccclass("camera_positioning")
export class camera_positioning extends Component {
	/* --------------- 属性 --------------- */
	/** 定位图 */
	@property({ displayName: "定位图", type: cc.Node })
	positioning_image_node: cc.Node = null!;

	/** 摄像机输出 */
	@property({ displayName: "摄像机输出", type: cc.Node })
	camera_sprite_node: cc.Node = null!;
	/* --------------- private --------------- */
	/** 相机定位 */
	private _positioning!: tool_camera_positioning;
	/* ------------------------------- 生命周期 ------------------------------- */
	async onLoad() {
		this._init_data();
		this._init_view();
	}

	onDestroy() {}
	/* ------------------------------- 功能 ------------------------------- */
	/** 初始化数据 */
	private _init_data(): void {
		// this._positioning = new tool_camera_positioning({
		// 	extractor: new cv.AKAZE(),
		// 	img: this.positioning_image_node.sprite.spriteFrame?.texture["image"].data,
		// 	matcher: new cv.BFMatcher(cv.NORM_HAMMING, true),
		// 	knn_matcher: new cv.BFMatcher(),
		// 	match_ratio: 0.8,
		// 	draw_type_n: 0,
		// });
		// this._positioning.init();
	}

	/** 初始化视图 */
	private _init_view(): void {}
}
