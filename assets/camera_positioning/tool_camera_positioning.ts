import * as cc from "cc";

namespace _tool_camera_positioning {
	/** 图片类型 */
	export type img_t = HTMLCanvasElement | HTMLImageElement;

	/** 图片数据 */
	export class img_data {
		/** 图 */
		img: any;
		/** 灰度图 */
		img_gray: any;
		/** 关键点 */
		key_points: any;
		/** 描述符 */
		descriptors: any;

		reset(img_: img_t): void {
			// 必须先 delete 才能 reset
			if (this.img) {
				this.delete();
			}

			// 图
			this.img = cv.imread(img_);
			this.img_gray = new cv.Mat(img_.width, img_.height, cv.CV_8UC1);
			this.key_points = new cv.KeyPointVector();
			this.descriptors = new cv.Mat();
			// 灰度图
			cv.cvtColor(this.img, this.img_gray, cv.COLOR_BGRA2GRAY);
		}

		/** 清理 */
		delete(): void {
			if (!this.img) {
				return;
			}
			// 销毁对象
			this.img.delete();
			this.img_gray.delete();
			this.key_points.delete();
			this.descriptors.delete();

			// 清理标记
			this.img = null;
		}
	}
}

/** 摄像机定位 */
class tool_camera_positioning {
	constructor(init_: tool_camera_positioning_.init_config) {
		this._init_data = new tool_camera_positioning_.init_config(init_);
	}
	/* --------------- private --------------- */
	private _init_data!: tool_camera_positioning_.init_config;
	/** 定位图 */
	private _img = new _tool_camera_positioning.img_data();
	/** 临时图 */
	private _img_temp = new _tool_camera_positioning.img_data();
	/** 上次临时图 */
	private _pre_img_temp: _tool_camera_positioning.img_data | null = null;
	/** 匹配结果 */
	private _match_result: any;
	/** 匹配结果筛选 */
	private _match_result_filter: any;
	/** 单应性矩阵 */
	private _homography: any;
	/** 扭曲图数据 */
	private _image_final_result: any;
	/** 销毁列表 */
	private _delete_as: any[] = [];
	/** 定位图匹配点数组 */
	private _img_temp_match_point_ns: number[] = [];
	/** 临时图匹配点数组 */
	private _img_match_point_ns: number[] = [];
	/** 空矩阵 */
	private _none_mat: any;
	/** 跟踪状态 */
	private _track_status_b = false;
	/** 匹配点数量 */
	private _matches_n = 0;
	/** 定位图定位点 */
	private _img_pos_mat = new cv.Mat(4, 1, cv.CV_32FC2);
	/** 临时图定位点 */
	private _img_temp_pos_mat = new cv.Mat(4, 1, cv.CV_32FC2);
	/** 绘制节点 */
	private _graphics!: cc.Graphics;
	/* ------------------------------- 功能 ------------------------------- */
	/** 初始化 */
	init(): void {
		this._none_mat = new cv.Mat();
		this._image_final_result = new cv.Mat();

		// 初始化定位图
		this._img.reset(this._init_data.img);
		this._feature_extraction(this._img);

		// 初始化定位图四角坐标
		this._img_pos_mat.data32F.set([
			// 左下
			0,
			0,
			// 右下
			this._img.img.cols,
			0,
			// 右上
			this._img.img.cols,
			this._img.img.rows,
			// 左上
			0,
			this._img.img.rows,
		]);

		// 绘制组件
		{
			// let node = new cc.Node();
			// cc.director.getScene()?.getComponentInChildren(cc.Canvas)!.node.addChild(node);
			// this._graphics = node.graphics;
			// node.width = node.parent!.width;
			// node.height = node.parent!.height;
			this._graphics = cc.find("Canvas/g")!.graphics;
		}
	}

	/** 销毁 */
	destroy(): void {
		this._img_pos_mat.delete();
		this._img_temp_pos_mat.delete();
		this._image_final_result.delete();
		this._img.delete();
		this._init_data.matcher.delete();
		this._init_data.knn_matcher.delete();
		this._init_data.extractor.delete();
		this._graphics.node.destroy();
	}

	/** 清理数据 */
	clear(): void {
		while (this._delete_as.length) {
			this._delete_as.pop().delete();
		}
	}

	/** 计算 */
	calculate(img_: _tool_camera_positioning.img_t): void {
		this._track_status_b = false;
		// 光流
		if (this._track_status_b) {
			this._track(img_);
		}
		// 重新匹配
		else {
			this._match(img_);
		}

		this.clear();
	}

	/** 跟踪图像 */
	private _track(img_: _tool_camera_positioning.img_t): void {
		if (!this._pre_img_temp) {
			return;
		}
		// 初始化图
		this._img_temp.reset(img_);

		this._track_status_b = false;

		/** 上次匹配点 */
		let framePts = this._auto_delete(
			new cv.Mat(this._img_match_point_ns.length * 0.5, 1, cv.CV_32FC2)
		);
		try {
			framePts.data32F.set(this._img_match_point_ns);
		} catch (e) {
			debugger;
		}
		/** 当前匹配点 */
		let currPts = new cv.Mat();
		/** 状态 */
		let status = new cv.Mat();
		/** 错误 */
		let err = new cv.Mat();
		try {
			cv.calcOpticalFlowPyrLK(
				this._pre_img_temp.img_gray,
				this._img_temp.img_gray,
				framePts,
				currPts,
				status,
				err
			);
		} catch (e) {
			debugger;
		}

		// // 转换坐标系
		// let height_n = this._img_temp.img.rows;
		// /** 转换到 cocos 坐标系 */
		// currPts.data32F.set(
		// 	currPts.data32F.map((v_n, k_n) => {
		// 		return k_n & 1 ? height_n - v_n : v_n;
		// 	})
		// );
		// framePts.data32F.set(
		// 	framePts.data32F.map((v_n, k_n) => {
		// 		return k_n & 1 ? height_n - v_n : v_n;
		// 	})
		// );

		// https://docs.opencv.org/3.4/d9/dab/tutorial_homography.html
		let goodPtsCurrNS: number[] = [];
		let goodPtsPrevNS: number[] = [];
		// 计算平均方差
		let mean,
			avg_variance = 0.0;
		let sum = 0.0;
		let diff: number;
		let diffs: number[] = [];
		for (let i = 0; i < framePts.data64F.length; ++i) {
			if (status.data[i]) {
				goodPtsCurrNS.push(currPts.data64F[i]);
				goodPtsPrevNS.push(framePts.data64F[i]);
				diff = Math.sqrt(
					Math.pow(currPts.data32F[i * 2] - framePts.data32F[i * 2], 2.0) +
						Math.pow(currPts.data32F[i * 2 + 1] - framePts.data32F[i * 2 + 1], 2.0)
				);
				sum += diff;
				diffs.push(diff);
			}
		}

		mean = sum / diffs.length;
		for (let i = 0; i < goodPtsCurrNS.length; ++i) {
			avg_variance += Math.pow(diffs[i] - mean, 2);
		}
		if (diffs.length) {
			avg_variance /= diffs.length;
		}
		if (isNaN(avg_variance)) {
			debugger;
		}

		// console.log("平均方差", avg_variance);
		if (goodPtsCurrNS.length > this._matches_n / 2 && 1.75 > avg_variance) {
			let goodPtsCurr = this._auto_delete(new cv.Mat(goodPtsCurrNS.length, 1, cv.CV_32FC2));
			let goodPtsPrev = this._auto_delete(new cv.Mat(goodPtsPrevNS.length, 1, cv.CV_32FC2));
			goodPtsCurr.data64F.set(goodPtsCurrNS);
			goodPtsPrev.data64F.set(goodPtsPrevNS);

			// 仿射变换
			// https://docs.opencv.org/3.4/d4/d61/tutorial_warp_affine.html
			let transform = cv.estimateAffine2D(goodPtsPrev, goodPtsCurr);

			// 添加行 {0,0,1} 进行转换，使其成为 3x3
			let temp = new cv.Mat(3, 3, cv.CV_64F);

			let testMat3 = cc.Mat3.fromArray(new cc.Mat3(), [
				...transform.data64F.slice(0),
				0,
				0,
				1,
			]);
			let invertMat3 = cc.Mat3.invert(new cc.Mat3(), testMat3);

			cc.Mat4.getRotation;

			// temp.data64F.set([
			// 	// 1
			// 	transform.data64F[0],
			// 	transform.data64F[1],
			// 	0,
			// 	// 2
			// 	transform.data64F[3],
			// 	transform.data64F[4],
			// 	0,
			// 	// 3
			// 	transform.data64F[2],
			// 	transform.data64F[5],
			// 	1,
			// ]);
			temp.data64F.set([...transform.data64F.slice(0), 0, 0, 1]);
			transform.delete();
			transform = temp;

			// this._homography.data64F.set(
			// 	[...this._homography.data64F].map((v, k_n) => v * transform.data64F[k_n])
			// );

			// update homography matrix
			let homographyCCMat3 = new cc.Mat3(...this._homography.data64F);
			let transformCCMat3 = invertMat3; //new cc.Mat3(...transform.data64F);
			homographyCCMat3 = homographyCCMat3.multiply(transformCCMat3);
			this._homography.data64F.set(cc.Mat3.toArray([], homographyCCMat3));

			// let transform22 = cc.mat4(
			// 	// 0
			// 	this._homography.doubleAt(0, 0),
			// 	this._homography.doubleAt(1, 0),
			// 	0,
			// 	this._homography.doubleAt(2, 0),
			// 	// 1
			// 	this._homography.doubleAt(0, 1),
			// 	this._homography.doubleAt(1, 1),
			// 	0,
			// 	this._homography.doubleAt(2, 1),
			// 	// 2
			// 	0,
			// 	0,
			// 	1,
			// 	0,
			// 	// 3
			// 	this._homography.doubleAt(0, 2),
			// 	this._homography.doubleAt(1, 2),
			// 	0,
			// 	this._homography.doubleAt(2, 2)
			// );

			// console.log(
			// 	"旋转",
			// 	transform22.getRotation(cc.quat()).getEulerAngles(cc.v3()).toString()
			// );
			// console.log("平移", transform22.getTranslation(cc.v3()).toString());
			// console.log("缩放", transform22.getScale(cc.v3()).toString());

			// transform22 = cc.mat4(
			// 	// 0
			// 	this._homography.doubleAt(0, 0),
			// 	this._homography.doubleAt(1, 0),
			// 	0,
			// 	this._homography.doubleAt(2, 0),
			// 	// 1
			// 	this._homography.doubleAt(0, 1),
			// 	this._homography.doubleAt(1, 1),
			// 	0,
			// 	this._homography.doubleAt(2, 1),
			// 	// 2
			// 	0,
			// 	0,
			// 	1,
			// 	0,
			// 	// 3
			// 	this._homography.doubleAt(0, 2),
			// 	this._homography.doubleAt(1, 2),
			// 	0,
			// 	this._homography.doubleAt(2, 2)
			// );

			// console.log(
			// 	"旋转",
			// 	transform22.getRotation(cc.quat()).getEulerAngles(cc.v3()).toString()
			// );
			// console.log("平移", transform22.getTranslation(cc.v3()).toString());
			// console.log("缩放", transform22.getScale(cc.v3()).toString());

			// set old points to new points
			this._img_match_point_ns = [...goodPtsCurr.data32F]; // framePts = goodPtsCurr;

			this._track_status_b = this._homography_valid(this._homography);
			if (this._track_status_b) {
				this._debug_output();
			}
		}
		this._pre_img_temp.delete();
		this._pre_img_temp = this._img_temp;
		this._img_temp = new _tool_camera_positioning.img_data();
	}

	/** 匹配图像 */
	private _match(img_: _tool_camera_positioning.img_t): void {
		this._auto_delete(this._pre_img_temp!);
		this._match_result = this._auto_delete(new cv.DMatchVectorVector());
		this._match_result_filter = this._auto_delete(new cv.DMatchVector());

		// 初始化图
		this._img_temp.reset(img_);

		// 特征提取
		if (!this._feature_extraction(this._img_temp)) {
			this._auto_delete(this._img_temp);
			this.clear();
			return;
		}

		// 获取匹配结果
		this._update_matching_result();
		// console.log("匹配点数量", this._match_result_filter.size());
		if (this._match_result_filter.size() < this._init_data.min_match_num!) {
			this._auto_delete(this._img_temp);
			this.clear();
			return;
		}

		// 计算单应性矩阵
		this._calculate_homography();

		// 更新跟踪状态
		this._track_status_b = this._homography_valid(this._homography);
		if (this._track_status_b) {
			this._matches_n = this._match_result_filter.size();
			this._debug_output();
			this._pre_img_temp?.delete();
			this._pre_img_temp = this._img_temp;
			this._img_temp = new _tool_camera_positioning.img_data();
		} else {
			this._auto_delete(this._img_temp);
		}
		// // https://ahmetozlu.medium.com/marker-less-augmented-reality-by-opencv-and-opengl-531b2af0a130
		// // https://raw.githubusercontent.com/ahmetozlu/open_source_markerless_augmented_reality/master/MarkerlessAR_V2/src/PatternDetector.cpp
	}

	/** 调试输出 */
	private _debug_output(): void {
		// https://docs.opencv.org/3.4/d9/dab/tutorial_homography.html
		// https://visp-doc.inria.fr/doxygen/camera_localization/tutorial-pose-dlt-planar-opencv.html
		cv.perspectiveTransform(this._img_pos_mat, this._img_temp_pos_mat, this._homography);

		let canvas_size = cc.find("Canvas")?.ui_transform.contentSize;
		let offset_v2 = cc.v2(0, 0);
		let width_n = this._img_temp.img.cols;
		let height_n = this._img_temp.img.rows;
		/** 转换到 cocos 坐标系 */
		let corners = [...this._img_temp_pos_mat.data32F].map((v_n, k_n) => {
			return k_n & 1 ? height_n - v_n : v_n;
		});
		this._graphics.clear();
		this._graphics.moveTo(corners[0], corners[1]);
		this._graphics.lineTo(corners[2], corners[3]);
		this._graphics.lineTo(corners[4], corners[5]);
		this._graphics.lineTo(corners[6], corners[7]);
		this._graphics.lineTo(corners[0], corners[1]);
		// this._graphics.close();
		this._graphics.stroke();

		let cube = cc.find("Camera3D/Cube")!;

		let homographyCCMat4 = new cc.Mat4(
			// 1
			this._homography.doubleAt(0, 0),
			this._homography.doubleAt(1, 0),
			0,
			this._homography.doubleAt(2, 0),
			// 2
			this._homography.doubleAt(0, 1),
			this._homography.doubleAt(1, 1),
			0,
			this._homography.doubleAt(2, 1),
			// 3
			0,
			0,
			1,
			0,
			// 4
			// this._homography.doubleAt(0, 2),
			// this._homography.doubleAt(1, 2),
			// 0,
			// this._homography.doubleAt(2, 2)
			cube.worldMatrix.m12,
			cube.worldMatrix.m13,
			cube.worldMatrix.m14,
			cube.worldMatrix.m15
		);
		// cube.worldMatrix = homographyCCMat4;
		// let transform = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]];

		console.log(
			"旋转",
			homographyCCMat4.getRotation(cc.quat()).getEulerAngles(cc.v3()).toString()
		);
		console.log("平移", homographyCCMat4.getTranslation(cc.v3()).toString());
		// console.log("缩放", homographyCCMat4.getScale(cc.v3()).toString());
		cube.setRotation(homographyCCMat4.getRotation(cc.quat()));
		// cube.setScale(homographyCCMat4.getScale(cc.v3()));
		return;
		// Normalization to ensure that ||c1|| = 1
		let norm = Math.sqrt(
			this._homography.doubleAt(0, 0) * this._homography.doubleAt(0, 0) +
				this._homography.doubleAt(1, 0) * this._homography.doubleAt(1, 0) +
				this._homography.doubleAt(2, 0) * this._homography.doubleAt(2, 0)
		);

		let homographyCCMat = new cc.Mat3(
			// 1
			this._homography.doubleAt(0, 0),
			this._homography.doubleAt(1, 0),
			this._homography.doubleAt(2, 0),
			// 2
			this._homography.doubleAt(0, 1),
			this._homography.doubleAt(1, 1),
			this._homography.doubleAt(2, 1),
			// 3
			this._homography.doubleAt(0, 2),
			this._homography.doubleAt(1, 2),
			this._homography.doubleAt(2, 2)
		);
		homographyCCMat.multiplyScalar(1 / norm);
		let c1 = cc.v3(homographyCCMat.m00, homographyCCMat.m01, homographyCCMat.m02);
		let c2 = cc.v3(homographyCCMat.m03, homographyCCMat.m04, homographyCCMat.m05);
		let c3 = c1.clone().cross(c2);
		// let c1 = this._homography.col(0);
		// let c2 = this._homography.col(1);
		// let c3 = c1.cross(c2);
		let tvec = cc.v3(homographyCCMat.m06, homographyCCMat.m07, homographyCCMat.m08);
		let R = new cv.Mat(3, 3, cv.CV_64F);
		R.data64F.set([c1.x, c2.x, c3.x, c1.y, c2.y, c3.y, c1.z, c2.z, c3.z]);

		let transform = cc.mat4(
			// 0
			c1.x,
			c2.x,
			c3.x,
			0,
			// 1
			c1.y,
			c2.y,
			c3.y,
			0,
			// 2
			c1.z,
			c2.z,
			c3.z,
			0,
			// 3
			tvec.x,
			tvec.y,
			tvec.z,
			1
		);
		// let transform = cc.mat4(
		// 	// 0
		// 	c1.x,
		// 	c1.y,
		// 	c1.z,
		// 	0,
		// 	// 1
		// 	c2.x,
		// 	c2.y,
		// 	c2.z,
		// 	0,
		// 	// 2
		// 	c3.x,
		// 	c3.y,
		// 	c3.z,
		// 	0,
		// 	// 3
		// 	tvec.x,
		// 	tvec.y,
		// 	tvec.z,
		// 	1
		// );

		// for (let i = 0; i < 3; i++) {
		// R.doubleAt(i, 0) = c1.doubleAt(i, 0);
		// R.doubleAt(i, 1) = c2.doubleAt(i, 0);
		// R.doubleAt(i, 2) = c3.doubleAt(i, 0);
		// }

		console.log("旋转", transform.getRotation(cc.quat()).getEulerAngles(cc.v3()).toString());
		console.log("平移", transform.getTranslation(cc.v3()).toString());
		console.log("缩放", transform.getScale(cc.v3()).toString());
		console.log("------------------");
		// 转为仿射变换 https://math.stackexchange.com/questions/296794/finding-the-transform-matrix-from-4-projected-points-with-javascript
		transform = cc.mat4(
			// 0
			this._homography.doubleAt(0, 0),
			this._homography.doubleAt(1, 0),
			0,
			this._homography.doubleAt(2, 0),
			// 1
			this._homography.doubleAt(0, 1),
			this._homography.doubleAt(1, 1),
			0,
			this._homography.doubleAt(2, 1),
			// 2
			0,
			0,
			1,
			0,
			// 3
			this._homography.doubleAt(0, 2),
			this._homography.doubleAt(1, 2),
			0,
			this._homography.doubleAt(2, 2)
		);
		console.log("旋转", transform.getRotation(cc.quat()).getEulerAngles(cc.v3()).toString());
		console.log("平移", transform.getTranslation(cc.v3()).toString());
		console.log("缩放", transform.getScale(cc.v3()).toString());
		// // 转换后点
		// cc.log(this._img_temp_pos_mat.data32F);

		// output->valid = valid;
	}

	/** 单应性有效判断 */
	private _homography_valid(H: any): boolean {
		const N = 10;
		const det = H.doubleAt(0, 0) * H.doubleAt(1, 1) - H.doubleAt(1, 0) * H.doubleAt(0, 1);
		return 1 / N < Math.abs(det) && Math.abs(det) < N;
	}

	/** 自动清理数据 */
	private _auto_delete<T extends { delete: () => void }>(data_: T): T {
		if (!data_) {
			return data_;
		}
		this._delete_as.push(data_);
		return data_;
	}

	/**
	 * 特征提取
	 */
	private _feature_extraction(img_: _tool_camera_positioning.img_data): boolean {
		if (img_.key_points.size()) {
			return true;
		}

		// 检查关键点并计算描述符
		this._init_data.extractor.detectAndCompute(
			img_.img_gray,
			this._none_mat,
			img_.key_points,
			img_.descriptors
		);
		if (!img_.key_points.size() || img_.descriptors.empty()) {
			return false;
		}
		return true;
	}

	/** 计算单应性矩阵 */
	private _calculate_homography(): void {
		let src_mat = this._auto_delete(
			new cv.Mat(this._img_temp_match_point_ns.length * 0.5, 1, cv.CV_32FC2)
		);
		let dst_mat = this._auto_delete(
			new cv.Mat(this._img_match_point_ns.length * 0.5, 1, cv.CV_32FC2)
		);
		src_mat.data32F.set(this._img_temp_match_point_ns);
		dst_mat.data32F.set(this._img_match_point_ns);

		this._homography = cv.findHomography(dst_mat, src_mat, cv.RANSAC);
	}

	/** 更新匹配结果 */
	private _update_matching_result(): void {
		this._img_temp_match_point_ns.splice(0, this._img_temp_match_point_ns.length);
		this._img_match_point_ns.splice(0, this._img_match_point_ns.length);
		// 筛选匹配点
		{
			let matcher: any;
			// 暴力匹配
			if (this._init_data.match_ratio) {
				matcher = this._init_data.knn_matcher;
				matcher.knnMatch(
					this._img.descriptors,
					this._img_temp.descriptors,
					this._match_result,
					2
				);
				for (let k_n = 0, len_n = this._match_result.size(); k_n < len_n; ++k_n) {
					let match = this._match_result.get(k_n);
					let point = match.get(0);
					let point2 = match.get(1);
					if (point.distance <= point2.distance * this._init_data.match_ratio) {
						this._match_result_filter.push_back(point);

						// 录入数组
						{
							this._img_match_point_ns.push(
								this._img.key_points.get(point.queryIdx).pt.x
							);
							this._img_match_point_ns.push(
								this._img.key_points.get(point.queryIdx).pt.y
							);
							this._img_temp_match_point_ns.push(
								this._img_temp.key_points.get(point.trainIdx).pt.x
							);
							this._img_temp_match_point_ns.push(
								this._img_temp.key_points.get(point.trainIdx).pt.y
							);
						}
					}
				}
			}
			// 匹配算法
			else {
				matcher = this._init_data.matcher;
				matcher.match(
					this._img.descriptors,
					this._img_temp.descriptors,
					this._match_result_filter
				);

				// 录入数组
				{
					for (
						let k_n = 0, len_n = this._match_result_filter.size();
						k_n < len_n;
						++k_n
					) {
						this._img_match_point_ns.push(
							this._img.key_points.get(this._match_result_filter.get(k_n).queryIdx).pt
								.x
						);
						this._img_match_point_ns.push(
							this._img.key_points.get(this._match_result_filter.get(k_n).queryIdx).pt
								.y
						);
						this._img_temp_match_point_ns.push(
							this._img_temp.key_points.get(
								this._match_result_filter.get(k_n).trainIdx
							).pt.x
						);
						this._img_temp_match_point_ns.push(
							this._img_temp.key_points.get(
								this._match_result_filter.get(k_n).trainIdx
							).pt.y
						);
					}
				}
			}
			matcher.clear();
		}
	}
}

export namespace tool_camera_positioning_ {
	/** 绘制数据 */
	export enum draw {
		/** 关键点 */
		key_point = 1,
		/** 匹配点 */
		match_point = 2,
	}

	/** 初始化数据 */
	export class init_config {
		constructor(init_?: init_config) {
			Object.assign(this, init_);
		}
		/** 定位图 */
		img!: _tool_camera_positioning.img_t;
		/** 特征提取器 */
		extractor: any;
		/** 匹配器 */
		matcher: any;
		/** 暴力匹配器 */
		knn_matcher: any;
		/** 匹配比率（越小越精准，一般为 0.7，不填则不使用 knnMatch） */
		match_ratio?: number;
		/** 图片节点（0：定位图，1：临时图、绘制节点下必须存在 Graphics 组件） */
		node_as?: cc.Node[] = [];
		/** 绘制类型 */
		draw_type_n? = 0;
		/** 最小匹配点数量限制（单应性最低4个点） */
		min_match_num? = 10;
	}
}

export default tool_camera_positioning;
