import { Link, useLocation } from "wouter";

const tabs = [
  { path: "/", label: "Project Selection" },
  { path: "/extraction", label: "Extraction Overview" },
  { path: "/migration", label: "Migration" },
  { path: "/audit", label: "Audit & Logs" },
  { path: "/settings", label: "Settings" },
];

export function NavigationTabs() {
  const [location] = useLocation();

  return (
    <nav className="flex space-x-8 mb-8">
      {tabs.map((tab) => {
        const isActive = location === tab.path;
        return (
          <Link key={tab.path} href={tab.path}>
            <span
              className={`border-b-4 py-3 px-1 text-m font-medium transition-colors cursor-pointer ${
                isActive
                  ? "border-azure-blue text-azure-blue"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
