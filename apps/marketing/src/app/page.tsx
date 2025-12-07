import Hero from "../components/Hero";
import Feature from "../components/Feature";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Feature title="Acciones Valorable" />
      <Footer />
    </>
  );
}
