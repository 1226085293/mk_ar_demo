function Align_img() {
	let detector_option = document.getElementById("detector").value;
	let match_option = document.getElementById("match").value;
	let matchDistance_option = document.getElementById("distance").value;
	let knnDistance_option = document.getElementById("knn_distance").value;
	let pyrDown_option = document.getElementById("pyrDown").value;

	//If the users is going to try a second attempt we need to clear out the canvases
	let image_blank_element = document.getElementById("image_blank");
	let im_blank = cv.imread(image_blank_element);
	cv.imshow("keypoints1", im_blank);
	cv.imshow("keypoints2", im_blank);
	cv.imshow("imageCompareMatches", im_blank);
	cv.imshow("imageAligned", im_blank);
	cv.imshow("inlierMatches", im_blank);

	console.error(
		"STEP 1: READ IN IMAGES **********************************************************************"
	);
	//im2 is the original reference image we are trying to align to
	let im2 = cv.imread(image_A_element);
	getMatStats(im2, "original reference image");
	//im1 is the image we are trying to line up correctly
	let im1 = cv.imread(image_B_element);
	getMatStats(im1, "original image to line up");

	if (pyrDown_option !== "No") {
		console.log("User selected option to pyrDown image");
		cv.pyrDown(im1, im1, new cv.Size(0, 0), cv.BORDER_DEFAULT);
		cv.pyrDown(im2, im2, new cv.Size(0, 0), cv.BORDER_DEFAULT);
		getMatStats(im1, "new stats for im1");
		getMatStats(im2, "new stats for im2");
	}

	console.error(
		"STEP 2: CONVERT IMAGES TO GRAYSCALE *********************************************************"
	);
	//17            Convert images to grayscale
	//18            Mat im1Gray, im2Gray;
	//19            cvtColor(im1, im1Gray, CV_BGR2GRAY);
	//20            cvtColor(im2, im2Gray, CV_BGR2GRAY);
	let im1Gray = new cv.Mat();
	let im2Gray = new cv.Mat();
	cv.cvtColor(im1, im1Gray, cv.COLOR_BGRA2GRAY);
	getMatStats(im1Gray, "reference image converted to BGRA2GRAY");
	cv.cvtColor(im2, im2Gray, cv.COLOR_BGRA2GRAY);
	getMatStats(im2Gray, "image to line up converted to BGRA2GRAY");

	console.error(
		"STEP 3: DETECT FEATURES & COMPUTE DESCRIPTORS************************************************"
	);
	//22            Variables to store keypoints and descriptors
	//23            std::vector<KeyPoint> keypoints1, keypoints2;
	//24            Mat descriptors1, descriptors2;
	let keypoints1 = new cv.KeyPointVector();
	let keypoints2 = new cv.KeyPointVector();
	let descriptors1 = new cv.Mat();
	let descriptors2 = new cv.Mat();
	//26            Detect ORB features and compute descriptors.
	//27            Ptr<Feature2D> orb = ORB::create(MAX_FEATURES);
	//28            orb->detectAndCompute(im1Gray, Mat(), keypoints1, descriptors1);
	//29            orb->detectAndCompute(im2Gray, Mat(), keypoints2, descriptors2);

	if (detector_option == 0) {
		var X = new cv.ORB(5000);
		console.log("using cv.ORB");
	} else if (detector_option == 1) {
		var X = new cv.AKAZE();
		console.log("using cv.AKAZE");
	} else if (detector_option == 2) {
		var X = new cv.KAZE();
		console.log("using cv.KAZE");
	}

	X.detectAndCompute(im1Gray, new cv.Mat(), keypoints1, descriptors1);
	X.detectAndCompute(im2Gray, new cv.Mat(), keypoints2, descriptors2);

	console.log("keypoints1: ", keypoints1);
	console.log("descriptors1: ", descriptors1);
	console.log("keypoints2: ", keypoints2);
	console.log("descriptors2: ", descriptors2);
	getMatStats(descriptors1, "descriptors1");
	getMatStats(descriptors2, "descriptors2");

	//draw all the keypoints on each image and display it to the user
	let keypoints1_img = new cv.Mat();
	let keypoints2_img = new cv.Mat();
	let keypointcolor = new cv.Scalar(0, 255, 0, 255);
	//this flag does not work because of bug https://github.com/opencv/opencv/issues/13641?_pjax=%23js-repo-pjax-container
	cv.drawKeypoints(im1Gray, keypoints1, keypoints1_img, keypointcolor);
	cv.drawKeypoints(im2Gray, keypoints2, keypoints2_img, keypointcolor); //cv.DrawMatchesFlags_DRAW_RICH_KEYPOINTS);//,

	cv.imshow("keypoints1", keypoints1_img);
	cv.imshow("keypoints2", keypoints2_img);

	// use to debug and list out all the keypoints
	console.log(
		"there are a total of ",
		keypoints1.size(),
		" keypoints1 (img to aligned) and ",
		keypoints2.size(),
		" keypoints2 (reference)"
	);
	console.log("here are the first 5 keypoints for keypoints1 - image to align.");
	for (let i = 0; i < keypoints1.size(); i++) {
		console.log("keypoints1: [", i, "]", keypoints1.get(i).pt.x, keypoints1.get(i).pt.y);
		if (i === 5) {
			break;
		}
	}

	console.log("here are the first 5 keypoints for keypoints2 -- reference image");
	for (let i = 0; i < keypoints2.size(); i++) {
		console.log("keypoints2: [", i, "]", keypoints2.get(i).pt.x, keypoints2.get(i).pt.y);
		if (i === 5) {
			break;
		}
	}

	console.log(
		"there are a total of [",
		descriptors1.cols,
		"][",
		descriptors1.rows,
		"] descriptors1 [cols][rows] (img to aligned) and [",
		descriptors2.cols,
		"][",
		descriptors2.rows,
		"] descriptors2 (reference) [cols][rows]"
	);

	console.error(
		"STEP 4: MATCH FEATURES **********************************************************************"
	);
	//31            Match features.
	//32            std::vector<DMatch> matches;
	//33            Ptr<DescriptorMatcher> matcher = DescriptorMatcher::create("BruteForce-Hamming");
	//34            matcher->match(descriptors1, descriptors2, matches, Mat());

	let good_matches = new cv.DMatchVector();

	if (match_option == 0) {
		//match
		console.log("using match...");
		let bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
		let matches = new cv.DMatchVector();
		bf.match(descriptors1, descriptors2, matches);

		//36            Sort matches by score
		//37            std::sort(matches.begin(), matches.end());
		//39            Remove not so good matches
		//40            const int numGoodMatches = matches.size() * GOOD_MATCH_PERCENT;
		//41            matches.erase(matches.begin()+numGoodMatches, matches.end());
		console.log("matches.size: ", matches.size());
		for (let i = 0; i < matches.size(); i++) {
			if (matches.get(i).distance < matchDistance_option) {
				good_matches.push_back(matches.get(i));
			}
		}
		if (good_matches.size() <= 3) {
			alert(
				"Less than 4 good matches found! counter =" +
					good_matches.size() +
					" try changing distance."
			);
			return;
		}
	} else if (match_option == 1) {
		//knnMatch
		console.log("using knnMatch...");
		let bf = new cv.BFMatcher();
		let matches = new cv.DMatchVectorVector();
		//Reference: https://docs.opencv.org/3.3.0/db/d39/classcv_1_1DescriptorMatcher.html#a378f35c9b1a5dfa4022839a45cdf0e89
		bf.knnMatch(descriptors1, descriptors2, matches, 2);

		let counter = 0;
		for (let i = 0; i < matches.size(); ++i) {
			let match = matches.get(i);
			let dMatch1 = match.get(0);
			let dMatch2 = match.get(1);
			//console.log("[", i, "] ", "dMatch1: ", dMatch1, "dMatch2: ", dMatch2);
			if (dMatch1.distance <= dMatch2.distance * parseFloat(knnDistance_option)) {
				//console.log("***Good Match***", "dMatch1.distance: ", dMatch1.distance, "was less than or = to: ", "dMatch2.distance * parseFloat(knnDistance_option)", dMatch2.distance * parseFloat(knnDistance_option), "dMatch2.distance: ", dMatch2.distance, "knnDistance", knnDistance_option);
				good_matches.push_back(dMatch1);
				counter++;
			}
		}
		if (counter <= 3) {
			alert(
				"Less than 4 good matches found! Counter=" +
					counter +
					" try changing distance %. It's currently " +
					knnDistance_option
			);
			return;
		}
		console.log(
			"keeping ",
			counter,
			" points in good_matches vector out of ",
			matches.size(),
			" contained in this match vector:",
			matches
		);
		console.log("here are first 5 matches");
		for (let t = 0; t < matches.size(); ++t) {
			console.log("[" + t + "]", "matches: ", matches.get(t));
			if (t === 5) {
				break;
			}
		}
	}
	console.log("here are first 5 good_matches");
	for (let r = 0; r < good_matches.size(); ++r) {
		console.log("[" + r + "]", "good_matches: ", good_matches.get(r));
		if (r === 5) {
			break;
		}
	}

	console.error(
		"STEP 5: DRAW TOP MATCHES AND OUTPUT IMAGE TO SCREEN ***************************************"
	);
	//44            Draw top matches
	//45            Mat imMatches;
	//46            drawMatches(im1, keypoints1, im2, keypoints2, matches, imMatches);
	//47            imwrite("matches.jpg", imMatches);
	let imMatches = new cv.Mat();
	let color = new cv.Scalar(0, 255, 0, 255);
	cv.drawMatches(im1, keypoints1, im2, keypoints2, good_matches, imMatches, color);
	cv.imshow("imageCompareMatches", imMatches);
	getMatStats(imMatches, "imMatches");

	console.error(
		"STEP 6: EXTRACT LOCATION OF GOOD MATCHES AND BUILD POINT1 and POINT2 ARRAYS ***************"
	);
	//50            Extract location of good matches
	//51            std::vector<Point2f> points1, points2;
	//53            for( size_t i = 0; i < matches.size(); i++ )
	//54            {
	//55                points1.push_back( keypoints1[ matches[i].queryIdx ].pt );
	//56                points2.push_back( keypoints2[ matches[i].trainIdx ].pt );
	//57            }

	let points1 = [];
	let points2 = [];

	/* this is a test
    let points1 = create2dPointsArray(good_matches.size(), 2, 0);
    let points2 = create2dPointsArray(good_matches.size(), 2, 0);
    */

	for (let i = 0; i < good_matches.size(); i++) {
		points1.push(keypoints1.get(good_matches.get(i).queryIdx).pt.x);
		points1.push(keypoints1.get(good_matches.get(i).queryIdx).pt.y);
		points2.push(keypoints2.get(good_matches.get(i).trainIdx).pt.x);
		points2.push(keypoints2.get(good_matches.get(i).trainIdx).pt.y);

		/* this is a test
        points1[i][0] = keypoints1.get(good_matches.get(i).queryIdx ).pt.x;
        points1[i][1] = keypoints1.get(good_matches.get(i).queryIdx ).pt.y;
        points2[i][0] = keypoints2.get(good_matches.get(i).trainIdx ).pt.x;
        points2[i][1] = keypoints2.get(good_matches.get(i).trainIdx ).pt.y;
        */

		//from: https://answers.opencv.org/question/235594/opencvjs-findperspective-returns-wrong-corners-coordinates/
		//points1.push_back( new cv.Point(keypoints1.get(good_matches.get(i).queryIdx).pt.x, keypoints1.get(good_matches.get(i).queryIdx).pt.y));
		//points2.push_back( new cv.Point(keypoints2.get(good_matches.get(i).trainIdx).pt.x, keypoints2.get(good_matches.get(i).trainIdx).pt.y));
	}
	console.log("points1:", points1, "points2:", points2);

	console.error(
		"STEP 7: CREATE MAT1 and MAT2 FROM POINT1 and POINT2 ARRAYS ********************************"
	);
	//Alternative:
	//let mat1 = cv.matFromArray(points1.length, 1, cv.CV_32FC2, points1);
	//let mat2 = cv.matFromArray(points2.length, 1, cv.CV_32FC2, points2);

	var mat1 = new cv.Mat(points1.length, 1, cv.CV_32FC2);
	mat1.data32F.set(points1);
	var mat2 = new cv.Mat(points2.length, 1, cv.CV_32FC2);
	mat2.data32F.set(points2);

	/* this is a test
    var mat1 = new cv.Mat(points1.length,2,cv.CV_32F);
    mat1.data32F.set(points1);
    var mat2 = new cv.Mat(points2.length,2,cv.CV_32F);
    mat2.data32F.set(points2);
    */

	getMatStats(mat1, "mat1 prior to homography");
	getMatStats(mat2, "mat2 prior to homography");

	console.error(
		"STEP 8: CALCULATE HOMOGRAPHY USING MAT1 and MAT2 ******************************************"
	);
	//59            Find homography
	//60            h = findHomography( points1, points2, RANSAC );
	//Reference: https://docs.opencv.org/3.3.0/d9/d0c/group__calib3d.html#ga4abc2ece9fab9398f2e560d53c8c9780
	//mat1:	Coordinates of the points in the original plane, a matrix of the type CV_32FC2 or vector<Point2f> .
	//mat2:	Coordinates of the points in the target plane, a matrix of the type CV_32FC2 or a vector<Point2f> .

	let findHomographyMask = new cv.Mat(); //test
	let h = cv.findHomography(mat1, mat2, cv.RANSAC, 3, findHomographyMask);
	if (h.empty()) {
		alert("homography matrix empty!");
		return;
	} else {
		console.log("h:", h);
		console.log("[", h.data64F[0], ",", h.data64F[1], ",", h.data64F[2]);
		console.log("", h.data64F[3], ",", h.data64F[4], ",", h.data64F[5]);
		console.log("", h.data64F[6], ",", h.data64F[7], ",", h.data64F[8], "]");

		getMatStats(findHomographyMask, "findHomographyMask"); //test
		console.log(
			"here are the inliers from RANSAC, compare to the good_matches array above",
			findHomographyMask.rows
		); //test
		//for (let i = 0; i < findHomographyMask.rows; ++i) {
		//    console.log("inliers", findHomographyMask.data[i], "points2: ", points2[i]);
		//}
		let good_inlier_matches = new cv.DMatchVector();
		for (let i = 0; i < findHomographyMask.rows; i = i + 2) {
			if (findHomographyMask.data[i] === 1 || findHomographyMask.data[i + 1] === 1) {
				let x = points2[i];
				let y = points2[i + 1];
				//console.log("i: ", i, " x: ", x, " y: ", y, "   Found it in points2!");
				for (let j = 0; j < keypoints2.size(); ++j) {
					if (x === keypoints2.get(j).pt.x && y === keypoints2.get(j).pt.y) {
						//console.log("  -- j: ", j, "    Found item in keypoints2!")
						for (let k = 0; k < good_matches.size(); ++k) {
							if (j === good_matches.get(k).trainIdx) {
								//console.log("  -- k: ", k, "    Found item in good_matches!")
								good_inlier_matches.push_back(good_matches.get(k));
							}
						}
					}
				}
			}
		}
		var inlierMatches = new cv.Mat();
		cv.drawMatches(im1, keypoints1, im2, keypoints2, good_inlier_matches, inlierMatches, color);
		cv.imshow("inlierMatches", inlierMatches);
		console.log(
			"Good Matches: ",
			good_matches.size(),
			" inlier Matches: ",
			good_inlier_matches.size()
		);

		/*console.log("here are inlier good_matches");
        for (let r = 0; r < good_inlier_matches.size(); ++r) {
            console.log("[" + r + "]", "good_inlier_matches: ", good_inlier_matches.get(r));
        }
        console.log("here are outlier good_matches (better said, BAD Matches)");
        for (let r = 0; r < bad_outlier_matches.size(); ++r) {
            console.log("[" + r + "]", "good_outlier_matches: ", bad_outlier_matches.get(r));
        }*/
	}
	getMatStats(findHomographyMask, "findHomographyMask");

	console.error(
		"STEP 9: WARP IMAGE TO ALIGN WITH REFERENCE **************************************************"
	);
	//62          Use homography to warp image
	//63          warpPerspective(im1, im1Reg, h, im2.size());
	//Reference: https://docs.opencv.org/master/da/d54/group__imgproc__transform.html#gaf73673a7e8e18ec6963e3774e6a94b87
	let image_B_final_result = new cv.Mat();
	cv.warpPerspective(im1, image_B_final_result, h, im2.size());
	cv.imshow("imageAligned", image_B_final_result);
	getMatStats(image_B_final_result, "finalMat");

	X.delete();
	descriptors1.delete();
	descriptors2.delete();
	keypoints1.delete();
	keypoints2.delete();
	im1Gray.delete();
	im2Gray.delete();
	h.delete();
	image_B_final_result.delete();
	mat1.delete();
	mat2.delete();
	inlierMatches.delete();
}

function create2dPointsArray(rows, cols, defaultValue) {
	var arr = [];

	// Creates all lines:
	for (var i = 0; i < rows; i++) {
		// Creates an empty line
		arr.push([]);

		// Adds cols to the empty line:
		arr[i].push(new Array(cols));

		for (var j = 0; j < cols; j++) {
			// Initializes:
			arr[i][j] = defaultValue;
		}
	}

	return arr;
}
