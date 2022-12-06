import * as cc from "cc";
import { _decorator, Component, Node } from "cc";
import tool_camera_positioning from "./tool_camera_positioning";

const { ccclass, property } = _decorator;
@ccclass("camera_positioning")
export class camera_positioning extends Component {
	/* --------------- 属性 --------------- */
	@property({ displayName: "参考图", type: cc.Sprite })
	reference_image: cc.Sprite = null!;

	@property({ displayName: "对齐图", type: cc.Sprite })
	alignment_image: cc.Sprite = null!;

	@property({ displayName: "对齐图2", type: cc.ImageAsset })
	alignment_image2: cc.ImageAsset = null!;
	// @property({ displayName: "输出图", type: cc.Sprite })
	// output_image: cc.Sprite = null!;

	@property({ displayName: "绘图组件", type: cc.Graphics })
	graphics: cc.Graphics = null!;
	/* ------------------------------- 生命周期 ------------------------------- */
	async start() {
		// 参考流程：https://ahmetozlu.medium.com/marker-less-augmented-reality-by-opencv-and-opengl-531b2af0a130

		// 计算摄像机坐标
		// 相机校准和 3D 重建：https://docs.opencv.org/3.0-beta/modules/calib3d/doc/camera_calibration_and_3d_reconstruction.html#
		// opencv 论坛（新）：https://forum.opencv.org/
		// https://www.fdxlabs.com/calculate-x-y-z-real-world-coordinates-from-a-single-camera-using-opencv/
		// https://stackoverflow.com/questions/14444433/calculate-camera-world-position-with-opencv-python
		// https://opg.optica.org/ao/abstract.cfm?uri=ao-60-35-10901

		// https://scottsuhy.com/2021/02/01/image-alignment-feature-based-in-opencv-js-javascript/
		// https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html
		// https://forum.opencv.org/t/opencv-js-support-for-findhomography/1126/19
		// https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html
		// https://answers.opencv.org/questions/scope:all/sort:activity-desc/page:1/query:js/

		// cv::Ptr<cv::FeatureDetector>     detector  = new cv::ORB(1000),
		// cv::Ptr<cv::DescriptorExtractor> extractor = new cv::FREAK(false, false),
		// cv::Ptr<cv::DescriptorMatcher>   matcher   = new cv::BFMatcher(cv::NORM_HAMMING, true),

		// // AKAZE
		let positioning = new tool_camera_positioning({
			extractor: new cv.AKAZE(),
			img: this.reference_image.spriteFrame?.texture["image"].data,
			matcher: new cv.BFMatcher(cv.NORM_HAMMING, true),
			knn_matcher: new cv.BFMatcher(),
			match_ratio: 0.8,
			node_as: [this.reference_image.node, this.alignment_image.node],
			graphics: this.graphics,
			draw_type_n: 0,
		});
		positioning.init();

		let count_n = 0;
		this.schedule(() => {
			positioning.calculate(this.alignment_image.spriteFrame?.texture["image"].data);
			return;
			cc.log("----------------" + count_n + "----------------");
			if (count_n++ === 1) {
				positioning.calculate(this.alignment_image2.data as any);
			} else {
				positioning.calculate(this.alignment_image.spriteFrame?.texture["image"].data);
			}
		}, 0);
		// camera_position_a.destroy();
		// return;
	}
}
