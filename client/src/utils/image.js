export function fileToPreview(file) {
  if (!file) return "";
  return URL.createObjectURL(file);
}

export function dataUrlToFile(dataUrl, filename) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    array[index] = binary.charCodeAt(index);
  }
  return new File([array], filename, { type: mime });
}

export async function cropToBusinessCard(file) {
  const image = await loadImage(file);
  const targetRatio = 1.75;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (sourceWidth / sourceHeight > targetRatio) {
    sourceWidth = sourceHeight * targetRatio;
  } else {
    sourceHeight = sourceWidth / targetRatio;
  }

  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = Math.round(1400 / targetRatio);
  const context = canvas.getContext("2d");
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        const cropped = new File([blob], file.name.replace(/\.[^.]+$/, "") + "-card.jpg", { type: "image/jpeg" });
        resolve(cropped);
      },
      "image/jpeg",
      0.92
    );
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}
