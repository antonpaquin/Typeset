function test() {
	/* not actually displayed -- just here to fetch the 
	 * image and turn it into a b64 string
	 */
	var test_image = new Image(0, 0);
	var test_canvas = document.createElement("canvas");
	var test_ctx = test_canvas.getContext("2d");

	test_image.onload = () => {
		test_canvas.width = 730;
		test_canvas.height = 1133;
		test_ctx.drawImage(test_image, 0, 0);
		test_b64 = test_canvas.toDataURL();
		test_b64 = test_b64.substr(1 + test_b64.search(","));

		editor.load("png", test_b64);
	};

	test_image.src = "test/7.png";
}

