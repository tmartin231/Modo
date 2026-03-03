import { Outlet, Route, Routes } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Home } from "@/pages/Home";
import { ImageCompress } from "@/pages/ImageCompress";
import { ImageConvert } from "@/pages/ImageConvert";
import { ImageCrop } from "@/pages/ImageCrop";
import { ImageResize } from "@/pages/ImageResize";
import { Images } from "@/pages/Images";
import { Files } from "@/pages/Files";
import { Pdf } from "@/pages/Pdf";
import { PdfMerge } from "@/pages/PdfMerge";
import { PdfSplit } from "@/pages/PdfSplit";
import { PdfConvert } from "@/pages/PdfConvert";

function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="images" element={<Images />} />
        <Route path="images/convert" element={<ImageConvert />} />
        <Route path="images/compress" element={<ImageCompress />} />
        <Route path="images/resize" element={<ImageResize />} />
        <Route path="images/crop" element={<ImageCrop />} />
        <Route path="pdf" element={<Pdf />} />
        <Route path="pdf/merge" element={<PdfMerge />} />
        <Route path="pdf/split" element={<PdfSplit />} />
        <Route path="pdf/convert" element={<PdfConvert />} />
        <Route path="files" element={<Files />} />
      </Route>
    </Routes>
  );
}

export default App;
