import * as cc from "cc";
import { _decorator, Component, Node } from "cc";
// import * as cv from "./opencv";
const cv = self["cv"];

const { ccclass, property } = _decorator;
@ccclass("main")
export class main extends Component {
	/* --------------- 属性 --------------- */
	/** 摄像机输出 */
	@property({ displayName: "摄像机输出", type: cc.Sprite })
	camera_sprite: cc.Sprite = null!;

	@property({ displayName: "标记图", type: cc.ImageAsset })
	mark_image: cc.ImageAsset = null!;
	/* --------------- private --------------- */
	/** 初始化状态 */
	private _init_b = false;
	private _h5_canvas!: HTMLCanvasElement;
	private _h5_image = new Image();
	private _h5_video!: HTMLVideoElement;
	private _image = new cc.ImageAsset();
	/* ------------------------------- 生命周期 ------------------------------- */
	async onLoad() {
		// https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html
		// https://scottsuhy.com/2021/02/01/image-alignment-feature-based-in-opencv-js-javascript/
		// https://forum.opencv.org/t/opencv-js-support-for-findhomography/1126/19
		// https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html
		// https://answers.opencv.org/questions/scope:all/sort:activity-desc/page:1/query:js/

		// let img1 = cv.imread(this.camera_sprite.spriteFrame?.texture["image"].data);
		// let img1_gray = new cv.Mat();
		// let orb = new cv.ORB(500);
		// let kp = new cv.KeyPointVector();
		// let descriptors1 = new cv.Mat();

		// cv.cvtColor(img1, img1_gray, cv.COLOR_BGR2GRAY);
		// orb.detectAndCompute(img1_gray, new cv.Mat(), kp, descriptors1);

		this._h5_canvas = document.createElement("canvas");
		this._h5_video = document.createElement("video");

		this._h5_video.setAttribute("autoplay", "");
		this._h5_video.setAttribute("muted", "");
		this._h5_video.setAttribute("playsinline", "");

		// this._h5_canvas.width = this._h5_video.width = cc.screen.windowSize.width;
		// this._h5_canvas.height = this._h5_video.height = cc.screen.windowSize.height;

		// // ios 需要使用 https
		// if (!self.navigator.mediaDevices) {
		// 	return;
		// }

		// let img1 = cv.imread(this.mark_image.data);
		// let img1_gray = new cv.Mat();
		// let orb = new cv.ORB(500);
		// let kp = new cv.KeyPointVector();
		// let descriptors1 = new cv.Mat();

		// cv.cvtColor(img1, img1_gray, cv.COLOR_BGR2GRAY);
		// orb.detectAndCompute(img1_gray, new cv.Mat(), kp, descriptors1);

		// let query_img_bw = new cv.Mat();
		// cv.cvtColor(img1, query_img_bw, cv.COLOR_BGR2GRAY);
		// let orb = new cv.ORB();
		// let kp = new cv.KeyPointVector();
		// // 检测图像中的关键点。
		// orb.detect(query_img_bw, kp);
		// let matcher = new cv.BFMatcher();

		self.navigator.mediaDevices
			.getUserMedia({
				video: {
					facingMode: "environment",
				},
			})
			.then(async (stream) => {
				this._h5_video.srcObject = stream;
				this._h5_video.play();
				this._init_b = true;

				this._h5_image.onload = () => {
					// HTMLImageElement 转 cc.ImageAsset
					this._image.reset(this._h5_image);
					let new_texture = new cc.Texture2D();
					new_texture.image = this._image;
					this.camera_sprite.spriteFrame!.texture = new_texture;
					this.camera_sprite.markForUpdateRenderData();

					// let img2 = cv.imread(this.mark_image.data);
					// let img2_gray = new cv.Mat();
					// let orb2 = new cv.ORB(500);
					// let kp2 = new cv.KeyPointVector();
					// let descriptors2 = new cv.Mat();

					// cv.cvtColor(img2, img2_gray, cv.COLOR_BGR2GRAY);
					// orb2.detectAndCompute(img2_gray, new cv.Mat(), kp2, descriptors2);

					// /** 匹配器 */
					// let matcher = new cv.BFMatcher();
					// /** 匹配结果 */
					// let matches = new cv.DMatchVector();
					// matcher.match(descriptors1, descriptors2, matches);

					// let points1 = new cv.PointVector();
					// let points2 = new cv.PointVector();
					// try {
					// 	let H = cv.findHomography(points1, points2, cv.RANSAC);
					// 	cc.log("成功匹配", H);
					// } catch (e) {}

					// let img2 = cv.imread(this._h5_image);
					// let query_img_bw2 = new cv.Mat();
					// cv.cvtColor(img2, query_img_bw2, cv.COLOR_BGR2GRAY);
					// let orb2 = new cv.ORB();
					// let kp2 = new cv.KeyPointVector();
					// // 检测图像中的关键点。
					// orb2.detect(query_img_bw2, kp2);
					// let dmatch = new cv.DMatchVector();
					// let matches = matcher.match(kp, kp2, dmatch);
				};
			})
			.catch((error) => {
				console.log(error.code, error.message, error);
			});

		// let orb = new cv.ORB();
		// let kp = new cv.KeyPointVector();
		// orb.detect(imgMat, kp);
		// console.log("kp", kp);

		// let imgMat = cv.imread(imgElement);
		// let orb = new cv.ORB();
		// let kp = orb.detect(imgMat, "");
		// console.log("kp", kp);

		// // image 和 mask 的类型为 cv.Mat
		// // orb.detect(image, keyPoints, mask);
		// // orb.compute(image, keyPoints, descriptors);

		// keyPoints.delete();
		// descriptors.delete();
		// orb.delete();
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
		/** canvas 转 base64 */
		this._h5_image.src = this._h5_canvas.toDataURL("image/png");
	}
}
