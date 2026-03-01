import { Outlet, Route, Routes } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Home } from "@/pages/Home";
import { ImageCompress } from "@/pages/ImageCompress";
import { ImageConvert } from "@/pages/ImageConvert";
import { ImageResize } from "@/pages/ImageResize";
import { Images } from "@/pages/Images";
import { Placeholder } from "@/pages/Placeholder";

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
        <Route
          path="images/crop"
          element={
            <Placeholder titleKey="images.tools.crop.title" backTo="/images" />
          }
        />
        <Route
          path="pdf"
          element={<Placeholder title="PDF" />}
        />
        <Route
          path="files"
          element={<Placeholder title="Andere Dateien" />}
        />
      </Route>
    </Routes>
  );
}

export default App;
