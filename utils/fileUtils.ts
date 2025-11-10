export const fileToBase64 = (file: File): Promise<{ mimeType: string, data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64Data] = result.split(',');
      const mimeTypeMatch = header.match(/:(.*?);/);
      
      if (!mimeTypeMatch || !mimeTypeMatch[1] || !base64Data) {
        reject(new Error("Could not parse the file format."));
      } else {
        const mimeType = mimeTypeMatch[1];
        resolve({ mimeType, data: base64Data });
      }
    };
    reader.onerror = error => reject(error);
  });
};
