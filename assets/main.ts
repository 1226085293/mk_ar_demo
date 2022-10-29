import * as cc from "cc";
import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;
import Uppy from '@uppy/core'
// import Webcam from '@uppy/webcam'

@ccclass('main')
export class main extends Component {
	@property({ type: cc.Sprite })
	spriteComp: cc.Sprite = null;
    
	private _canvas: HTMLCanvasElement;
	private _texture = new cc.Texture2D();
	private _image = new cc.ImageAsset();

    start() {
		this._canvas = document.createElement("canvas");
        this._canvas.width = cc.screen.windowSize.width;
        this._canvas.height = cc.screen.windowSize.height;
		this._texture.image = this._image;


        const uppy = new Uppy();
        // uppy.use(Webcam, {
        //   mirror: true,
        //   facingMode: 'user',
        //   showRecordingLength: true,
        //   target: this._canvas
        // });
    }

    
	update() {
		// this.updateTexture();
	}
	updateTexture() {
		let base64String = this._canvas.toDataURL("image/png");
		var img = new Image();
		img.src = base64String;

		var self = this;
		img.onload = function () {
			self._image.reset(img);

			let _texture = new cc.Texture2D();
			_texture.image = self._image;

			self.spriteComp.spriteFrame.texture = _texture;
			self.spriteComp.markForUpdateRenderData();
		};
	}
}

