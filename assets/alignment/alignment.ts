import * as cc from "cc";
import { _decorator, Component, Node } from "cc";
// import * as cv from "./opencv";
// const cv = self["cv"];

const { ccclass, property } = _decorator;
@ccclass("alignment")
export class alignment extends Component {
	/* --------------- 属性 --------------- */
	@property({ displayName: "参考图", type: cc.Sprite })
	reference_image: cc.Sprite = null!;

	@property({ displayName: "对齐图", type: cc.Sprite })
	alignment_image: cc.Sprite = null!;

	@property({ displayName: "输出图", type: cc.Sprite })
	output_image: cc.Sprite = null!;

	@property({ displayName: "绘图组件", type: cc.Graphics })
	graphics: cc.Graphics = null!;
	/* --------------- private --------------- */
	/** 关键点检测器 */
	private _keypoint_detector = new cv.AKAZE();
	/** 特征提取器 */
	private _feature_extractor = new cv.AKAZE();
	/* ------------------------------- 生命周期 ------------------------------- */
	async start() {
		// 计算摄像机坐标
		// https://ahmetozlu.medium.com/marker-less-augmented-reality-by-opencv-and-opengl-531b2af0a130
		// https://www.fdxlabs.com/calculate-x-y-z-real-world-coordinates-from-a-single-camera-using-opencv/
		// https://stackoverflow.com/questions/14444433/calculate-camera-world-position-with-opencv-python
		// https://opg.optica.org/ao/abstract.cfm?uri=ao-60-35-10901

		// https://scottsuhy.com/2021/02/01/image-alignment-feature-based-in-opencv-js-javascript/
		// https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html
		// https://forum.opencv.org/t/opencv-js-support-for-findhomography/1126/19
		// https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html
		// https://answers.opencv.org/questions/scope:all/sort:activity-desc/page:1/query:js/
		// let img1 = cv.imread(this.camera_sprite.spriteFrame?.texture["image"].data);
		// let img1_gray = new cv.Mat();
		// let orb = new cv.ORB(500);
		// let kp = new cv.KeyPointVector();
		// let descriptors1 = new cv.Mat();

		/** 参考图 */
		let img = cv.imread(this.reference_image.spriteFrame?.texture["image"].data);
		/** 对齐图 */
		let img2 = cv.imread(this.alignment_image.spriteFrame?.texture["image"].data);
		/** 参考图灰度 */
		let img_gray = new cv.Mat();
		/** 对齐图灰度 */
		let img2_gray = new cv.Mat();
		/** 参考图描述符 */
		let descriptors = new cv.Mat();
		/** 对齐图描述符 */
		let descriptors2 = new cv.Mat();
		/** 参考图关键点 */
		let key_points = new cv.KeyPointVector();
		/** 对齐图关键点 */
		let key_points2 = new cv.KeyPointVector();

		// 初始化灰度图
		{
			cv.cvtColor(img, img_gray, cv.COLOR_BGRA2GRAY);
			cv.cvtColor(img2, img2_gray, cv.COLOR_BGRA2GRAY);
		}

		// 检测特征和计算描述符
		// https://ieeexplore.ieee.org/document/8346440
		{
			this._extract_features(img_gray, key_points, descriptors);
			this._extract_features(img2_gray, key_points2, descriptors2);

			// orb.detectAndCompute(img_gray, new cv.Mat(), key_points, descriptors);
			// orb.detectAndCompute(img2_gray, new cv.Mat(), key_points2, descriptors2);

			cc.log(
				" 参考图关键点数量 ",
				key_points.size(),
				" 对齐图关键点数量 ",
				key_points2.size()
			);
			// 绘制关键点，坐标系不同需转换
			if (false) {
				/** 绘制间隔 */
				let for_interval_n = 2;
				// 参考图
				{
					this.graphics.moveTo(
						key_points.get(0).pt.x,
						this.reference_image.node.height - key_points.get(0).pt.y
					);
					for (
						let k_n = 1, len_n = key_points.size();
						k_n < len_n;
						k_n += for_interval_n
					) {
						this.graphics.circle(
							key_points.get(k_n).pt.x,
							this.reference_image.node.height - key_points.get(k_n).pt.y,
							6
						);
						this.graphics.stroke();
						this.graphics.moveTo(
							key_points.get(k_n).pt.x,
							this.reference_image.node.height - key_points.get(k_n).pt.y
						);
					}
				}
				// 对齐图
				{
					this.graphics.moveTo(
						key_points2.get(0).pt.x + this.reference_image.node.width,
						this.alignment_image.node.height - key_points2.get(0).pt.y
					);
					for (
						let k_n = 1, len_n = key_points2.size();
						k_n < len_n;
						k_n += for_interval_n
					) {
						this.graphics.circle(
							key_points2.get(k_n).pt.x + this.reference_image.node.width,
							this.alignment_image.node.height - key_points2.get(k_n).pt.y,
							6
						);
						this.graphics.stroke();
						this.graphics.moveTo(
							key_points2.get(k_n).pt.x + this.reference_image.node.width,
							this.alignment_image.node.height - key_points2.get(k_n).pt.y
						);
					}
				}
			}
		}

		/** 匹配结果筛选 */
		let match_result_filter = new cv.DMatchVector();

		// 匹配特征
		{
			/** 描述符匹配距离缩放率，越小则匹配越精准 */
			let match_dist_scaling_n = 0.75;
			/** 蛮力匹配器：该匹配器利用为第一组中检测到的特征计算的描述符与第二组中的所有描述符进行匹配。最后，它返回距离最近的匹配项。 */
			let bf_matcher = new cv.BFMatcher();
			/** 匹配结果 */
			let match_result = new cv.DMatchVectorVector();

			// 匹配
			bf_matcher.knnMatch(descriptors, descriptors2, match_result, 2);

			for (let k_n = 0, len_n = match_result.size(); k_n < len_n; ++k_n) {
				let match = match_result.get(k_n);
				let match_point = match.get(0);
				let match_point2 = match.get(1);
				if (match_point.distance <= match_point2.distance * match_dist_scaling_n) {
					match_result_filter.push_back(match_point);
				}
			}

			// 绘制匹配结果
			if (true) {
				// queryIdx: 参考图描述符下标
				// trainIdx: 对齐图描述符下标
				this.graphics.moveTo(
					key_points.get(match_result_filter.get(0).queryIdx).pt.x,
					this.reference_image.node.height -
						key_points.get(match_result_filter.get(0).queryIdx).pt.y
				);
				for (let k_n = 0, len_n = match_result_filter.size(); k_n < len_n; ++k_n) {
					// 随机绘制颜色
					this.graphics.strokeColor = [
						cc.Color.WHITE,
						cc.Color.GRAY,
						cc.Color.BLACK,
						cc.Color.TRANSPARENT,
						cc.Color.RED,
						cc.Color.GREEN,
						cc.Color.BLUE,
						cc.Color.CYAN,
						cc.Color.MAGENTA,
						cc.Color.YELLOW,
					][Math.floor(Math.random() * 9)];
					this.graphics.lineTo(
						key_points2.get(match_result_filter.get(k_n).trainIdx).pt.x +
							this.reference_image.node.width,
						this.alignment_image.node.height -
							key_points2.get(match_result_filter.get(k_n).trainIdx).pt.y
					);
					this.graphics.stroke();
					if (k_n + 1 < len_n) {
						this.graphics.moveTo(
							key_points.get(match_result_filter.get(k_n + 1).queryIdx).pt.x,
							this.alignment_image.node.height -
								key_points.get(match_result_filter.get(k_n + 1).queryIdx).pt.y
						);
					}
				}
			}
		}

		// 输出结果图
		{
			/** 结果图数据 */
			let image_final_result = new cv.Mat();

			let points: any[] = [];
			let points2: any[] = [];
			for (let i = 0; i < match_result_filter.size(); i++) {
				points.push(key_points2.get(match_result_filter.get(i).trainIdx).pt.x);
				points.push(key_points2.get(match_result_filter.get(i).trainIdx).pt.y);
				points2.push(key_points.get(match_result_filter.get(i).queryIdx).pt.x);
				points2.push(key_points.get(match_result_filter.get(i).queryIdx).pt.y);
			}
			let mat = new cv.Mat(points.length, 1, cv.CV_32FC2);
			let mat2 = new cv.Mat(points2.length, 1, cv.CV_32FC2);
			mat.data32F.set(points);
			mat2.data32F.set(points2);

			/** 单应性矩阵 */
			let h = cv.findHomography(mat, mat2, cv.RANSAC);

			if (h.empty()) {
				alert("homography matrix empty!");
				return;
			} else {
				console.log("匹配成功");
				// console.log("h:", h);
				// console.log("[", h.data64F[0], ",", h.data64F[1], ",", h.data64F[2]);
				// console.log("", h.data64F[3], ",", h.data64F[4], ",", h.data64F[5]);
				// console.log("", h.data64F[6], ",", h.data64F[7], ",", h.data64F[8], "]");
			}

			// 扭曲图像
			cv.warpPerspective(img2, image_final_result, h, img.size());

			// 绘制到 sprite
			{
				let canvas = document.createElement("canvas");
				let sprite_frame = new cc.SpriteFrame();
				let image_asset = new cc.ImageAsset();
				let new_texture = new cc.Texture2D();

				// 绘制到 canvas
				cv.imshow(canvas, image_final_result);
				image_asset.reset(canvas);
				new_texture.image = image_asset;
				sprite_frame.texture = new_texture;
				this.output_image.spriteFrame = sprite_frame;
			}
		}
	}

	/**
	 * 关键点检测 & 特征提取
	 * @param feature_
	 * @param img_
	 * @param key_points_
	 * @param descriptors_
	 */
	private _extract_features(img_: any, key_points_: any, descriptors_: any): boolean {
		// 检查关键点
		this._keypoint_detector.detect(img_, key_points_);
		if (!key_points_.size()) {
			return false;
		}
		// 计算描述符
		this._feature_extractor.compute(img_, key_points_, descriptors_);
		if (!descriptors_.empty()) {
			return false;
		}

		return true;
	}
}
