# Draw-The-Word-Fong-Chung-Sir 點寫方中sir

This parody Mini Game is based on HTML, CSS, and JavaScript, built with Electron. Allows users to draw the word  "sir" in traditional Chinese. This "sir" character is not a real character in Traditional Chinese. Instead, it originates from the Hong Kong movie *Love Undercover* (新紮師妹) 2002. In the movie, Chung Sir creates this unique Chinese "SIR" character as an excuse for a triad boss when trying to pass himself off as the "father" of Fong Lai-Kuan, needing to explain their different surnames.

Here, you will cosplay as Chung Sir, a.k.a. Fong Chung Sir, to write the character "sir" in Traditional Chinese. You still need to try and draw the character correctly! If your score is too low, the triads will know you are an Undercover police officer👮!

Enjoy the game in either English or Traditional Chinese!

## Screenshot
![Screenshot](https://github.com/dundd2/Draw-the-Word-Fong-Chung-Sir/blob/main/assets/Screenshot/Screenshot%20(1).gif)

## How to Access the Game

You can play "Draw-The-Word-Fong-Chung-Sir 點寫方中sir" in two ways:

**1. Play Online (Recommended):**

   - Simply visit this link in your web browser: [https://dundd2.github.io/Draw-the-Word-Fong-Chung-Sir/](https://dundd2.github.io/Draw-the-Word-Fong-Chung-Sir/)

**2. Play Offline (Standalone Application):**
The standalone executable is built using **Electron**, allowing for a cross-platform desktop experience.

   - **Download the Installer:** Get the latest installer from the Releases page. Download the file named `draw-the-Word-fong-chung-sir Setup 1.1.0.exe`.
   - **Install:** Double-click the downloaded `.exe` file and follow the installation prompts.
   - **Run:**  Launch the game after installation from your Start Menu or desktop.

## How to Play

1. **Observe the Target:** A faint outline of the intended "sir" character is displayed on the drawing canvas.
2. **Draw the Character:** Use your mouse or touch to draw on the white canvas, attempting to replicate the target character.
    *   **Click and drag** to draw lines.
3. **Customize Your Drawing (Optional):**
    *   Use the **colour picker** to select your desired drawing colour.
    *   Adjust the **line width** to control the thickness of your strokes.
4. **Use the Controls:**
    *   Click the **"↩ Undo** button to remove your last drawing stroke.
    *   Click the **"🔄Reset** button to clear the entire canvas and start over.
5. **Submit Your Masterpiece:** Click the **Submit** button when you are satisfied with your drawing.
6. **Check Your Score:**  Your score will be displayed, indicating how closely your drawing matches the target.
7. **Read the Feedback:**  Based on your score, you'll receive feedback simulating the reaction of the triad boss. A low score might reveal your true identity!

## Skills Used

*   **HTML:**  For structuring the webpage.
*   **CSS:** For styling the visual elements and layout.
*   **JavaScript:** For implementing the drawing functionality, user interaction, and scoring.
*   **TensorFlow.js:** For image processing and pattern recognition in drawing evaluation.
*   **Electron:** For building and packaging the cross-platform desktop application.

## Technical Details

### Drawing Canvas
The drawing canvas is implemented using the HTML5 `<canvas>` element. Users can draw on the canvas using mouse or touch events. The drawing strokes are captured and stored in an array for further processing.

### Scoring Algorithm
The scoring algorithm uses TensorFlow.js to compare the user's drawing with the target character. The steps involved are:
1. **Preprocessing**: The canvas content is converted to a tensor and resized to 28x28 pixels.
2. **Normalization**: The pixel values are normalized to the range [0, 1].
3. **Pattern Matching**: The user's drawing is compared with the target character using image processing techniques to calculate a similarity score.

### User Interface
The user interface is built with HTML and CSS, providing a responsive and interactive experience. Key features include:
- **Color Picker**: Allows users to select the drawing color.
- **Line Width Selector**: Enables users to adjust the thickness of their drawing strokes.
- **Undo and Reset Buttons**: Provide controls to undo the last stroke or reset the entire canvas.

## Credits
  - TensorFlow.js: Image processing and pattern recognition
    - [TensorFlow.js](https://www.tensorflow.org/js) is an open-source library developed by the TensorFlow team at Google. Licensed under the [Apache License 2.0](https://github.com/tensorflow/tfjs/blob/master/LICENSE).
  - Electron: Cross-platform desktop application framework
    - [Electron](https://www.electronjs.org/) is an open-source framework maintained by OpenJS Foundation. Licensed under the [MIT License](https://github.com/electron/electron/blob/main/LICENSE).

## 📜 License
This project is licensed under the MIT LICENSE.
