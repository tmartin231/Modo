import { Outlet, Route, Routes } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Home } from "@/pages/Home";
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
        <Route
          path="images"
          element={<Placeholder title="Bilder" />}
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
