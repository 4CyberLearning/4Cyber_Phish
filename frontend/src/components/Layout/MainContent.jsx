// src/components/Layout/MainContent.jsx
const MainContent = ({ children }) => {
return (
<main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
{children}

</main>
);
};


export default MainContent;