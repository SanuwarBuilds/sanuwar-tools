"""Practical workflows that connect the site's browser tools."""

GUIDES = {
    'prepare-files-for-an-online-form': {
        'title': 'Prepare a photo and signature for an online form',
        'intro': 'Turn the requirements on your application form into a correctly sized photo and signature, then verify both files before uploading.',
        'sections': [
            ('Write down the rules for each field', [
                'Record the required format, width, height and maximum file size for the photo and signature separately. If the instructions use a minimum as well as a maximum size, record both. Use the requirements on your actual form, since values vary by portal.',
                'As a practice example, suppose the photo field requires a JPG of 200 × 230 pixels and at most 50 KB. Enter 200 for width and 230 for height. Enter 50 in Maximum size (KB), and choose JPG.',
            ]),
            ('Crop and export with Photo Tools', [
                'Select the photo or signature mode, then open a copy of the original file. Set the required output dimensions before adjusting the crop so the preview shows the final proportions. Move the crop to keep the entire face or signature inside the frame.',
                'Choose the output format required by the portal before saving. For JPG, a file size limit can reduce image quality. Check that the preview is still readable. If a PNG is too large, keep the requested format and check whether the form permits smaller dimensions.',
            ]),
            ('Check the exported file', [
                'Open the exported copy in Form File Checker and enter the same requirements. Passing the checker verifies the selected format, file size and dimensions. Check the photo or signature visually for any additional rules listed on the form.',
                'If the portal rejects the upload, confirm you selected the exported copy. Compare the portal’s error with each checker result and check any minimum-size rule on the portal itself.',
            ]),
        ],
        'tools': [('Photo Tools', '/photo-tools'), ('Form File Checker', '/tools/form-file-checker')],
    },
    'assemble-a-pdf-application': {
        'title': 'Assemble, sign and compress a PDF application',
        'intro': 'Put a form and its supporting documents into one PDF, add visible marks where needed, and check that the final file fits the upload limit.',
        'sections': [
            ('Make a copy and put documents in order', [
                'Keep the original documents separate. For example, if the portal requests a signed form, proof of address and a supporting letter in one file, arrange those three documents in that order in PDF Merge.',
                'If a scan is sideways or contains a blank page, use PDF Page Organizer. Move pages earlier or later to change the order, or rotate a page to make it readable. Download the organized copy and inspect the page sequence before continuing.',
            ]),
            ('Add visible text and signatures', [
                'Open the organized PDF in Fill & Sign PDF. Select the correct page, choose Text, Date, Tick mark or a signature option, then place it on the preview. Review each affected page of the downloaded copy to check that marks do not cover another field.',
                'If the form explicitly requires a certificate-based digital signature, use the signing process specified by its issuer. Fill & Sign adds visible marks to the page.',
            ]),
            ('Reduce size and check readability', [
                'If the finished PDF exceeds the portal limit, try Optimize structure first. For scanned pages that are still too large, test Rasterize pages on a separate copy. Lower the resolution one step at a time and check small print, stamps and signatures before using the result.',
                'Open the final PDF in Form File Checker and compare its size and page count to the instructions. Keep the editable original in case you need to make a correction.',
            ]),
        ],
        'tools': [('PDF Merge', '/tools/pdf-merge'), ('PDF Page Organizer', '/tools/pdf-organizer'),
                  ('Fill & Sign PDF', '/tools/fill-sign-pdf'), ('PDF Compress', '/tools/pdf-compress')],
    },
    'make-and-test-a-qr-code': {
        'title': 'Make and test a QR code before printing',
        'intro': 'Create a QR code for a shop sign, menu or handout and check that customers can scan it at the intended size.',
        'sections': [
            ('Choose a destination and check it on a phone', [
                'For a menu or product page, copy the public page URL and open it in a browser where you are signed out. This catches links that work for you because you are logged in or have access to a private draft.',
                'Paste the public URL into QR Code Generator in URL mode. For a Wi-Fi card, choose Wi-Fi mode and enter the guest network details. Anyone who reads a Wi-Fi code can see or use the network details encoded in it.',
            ]),
            ('Download the code and test a print sample', [
                'Download the PNG and place it in your label or poster design. Leave a clear margin around the square, use a light background and keep the code square. Avoid putting text or decorative graphics over the code.',
                'Print one sample at the final size. Scan it from the distance people will use, with at least one phone other than the device you used to make it. Verify the address or network shown by the scan before printing the full batch.',
            ]),
            ('Diagnose scan failures', [
                'If scanning fails, first test the original PNG on screen. If it scans there, enlarge the printed code or improve contrast and space around it. If it scans but opens the wrong page, correct the original URL and generate a new PNG.',
                'A static QR code encodes the value you enter. If you expect a menu to change, point the code to a stable public menu page and update the content at that address.',
            ]),
        ],
        'tools': [('QR Code Generator', '/tools/qr-code-generator')],
    },
    'compress-photos-for-sharing': {
        'title': 'Make photos smaller for email and web',
        'intro': 'Use the right pixel width and file format, then check the result against your attachment limit.',
        'updated': '2026-11-25',
        'sections': [
            ('Pick a width for the way the photo will be used', [
                'Keep the original file for printing or later edits. For a photo that will appear at about 800 pixels wide on a web page, try a 1,600-pixel export for sharper display on high-density screens.',
                'For example, set Max width to 1600 for a 4000 × 3000 photo. The result will be 1600 × 1200, with the original aspect ratio preserved. Enter 0 to leave the dimensions unchanged.',
            ]),
            ('Choose a format and compare two exports', [
                'Drop the original into Image Compressor. Pick JPG for a photo that you want to email or send to someone whose app format support is unknown. Start at 80% quality and press Compress images. Check the output size shown in the results.',
                'Try WebP if the receiving site accepts it. For screenshots or logos that need transparent backgrounds, choose PNG or WebP. JPG replaces transparency with the selected background colour, and the quality slider does not control PNG export.',
            ]),
            ('Fit the attachment limit without losing legibility', [
                'If the limit is 500 KB and the result is still too large, lower quality in small steps or reduce the width from 1,600 to 1,200 pixels. Use the original each time to avoid recompressing a copy.',
                'Open the saved file and zoom in on text, faces or other details you need to preserve. For a form with exact pixel and file size rules, verify the exported file in Form File Checker before uploading.',
            ]),
        ],
        'tools': [('Image Compressor', '/tools/image-compressor'), ('Form File Checker', '/tools/form-file-checker')],
    },
}
