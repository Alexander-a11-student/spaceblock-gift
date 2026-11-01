import com.google.zxing.*;
import com.google.zxing.common.*;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.Map;
import javax.imageio.ImageIO;

public class MakeQR {
  public static void main(String[] args) throws Exception {
    String url = args[0];
    int size = 1952;
    BitMatrix matrix = new MultiFormatWriter().encode(url, BarcodeFormat.QR_CODE, size, size,
      Map.of(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H, EncodeHintType.MARGIN, 4));
    BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
    for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) image.setRGB(x, y, matrix.get(x,y) ? 0xff000000 : 0xffffffff);
    Path output = Path.of(args[1]);
    Files.createDirectories(output.getParent());
    ImageIO.write(image, "PNG", output.toFile());
    LuminanceSource luminance = new RGBLuminanceSource(size, size, image.getRGB(0, 0, size, size, null, 0, size));
    String decoded = new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(luminance))).getText();
    if (!url.equals(decoded)) throw new IllegalStateException("QR decode mismatch");
    System.out.println("QR verified: " + decoded + " (" + size + " x " + size + ")");
  }
}
