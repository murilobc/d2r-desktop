interface SkeletonProps {
  variant: "card" | "table-row" | "chart" | "text" | "page";
  count?: number;
  width?: string;
  height?: string;
}

export function Skeleton({ variant, count = 1, width, height }: SkeletonProps) {
  const elements = Array.from({ length: count }, (_, i) => {
    switch (variant) {
      case "card":
        return (
          <div
            key={i}
            className="skeleton-shimmer skeleton-card"
            style={{ width: width || "100%", height: height || "90px" }}
          />
        );
      case "table-row":
        return (
          <div
            key={i}
            className="skeleton-shimmer skeleton-table-row"
            style={{ width: width || "100%", height: height || "44px" }}
          />
        );
      case "chart":
        return (
          <div
            key={i}
            className="skeleton-shimmer skeleton-chart"
            style={{ width: width || "100%", height: height || "200px" }}
          />
        );
      case "text":
        return (
          <div
            key={i}
            className="skeleton-shimmer skeleton-text"
            style={{ width: width || "200px", height: height || "20px" }}
          />
        );
      case "page":
        return (
          <div key={i} className="skeleton-page">
            <div className="skeleton-shimmer skeleton-text" style={{ width: "200px", height: "32px" }} />
            <div className="skeleton-page-body">
              <div className="skeleton-shimmer skeleton-card" style={{ height: "120px" }} />
              <div className="skeleton-shimmer skeleton-card" style={{ height: "120px" }} />
            </div>
          </div>
        );
      default:
        return null;
    }
  });

  return <div className={`skeleton-container skeleton-container-${variant}`}>{elements}</div>;
}

/** Skeleton placeholder matching the Statistics page layout */
export function StatsSkeleton() {
  return (
    <div className="page">
      <div className="page-header">
        <Skeleton variant="text" width="200px" height="32px" />
      </div>
      <div className="stats-grid">
        <Skeleton variant="card" count={8} height="90px" />
      </div>
      <div className="charts-grid">
        <Skeleton variant="chart" count={2} height="200px" />
      </div>
    </div>
  );
}

/** Skeleton placeholder matching the History page layout */
export function HistorySkeleton() {
  return (
    <div className="page">
      <div className="page-header">
        <Skeleton variant="text" width="200px" height="32px" />
      </div>
      <Skeleton variant="table-row" count={10} />
    </div>
  );
}

/** Skeleton placeholder matching the Settings page layout */
export function SettingsSkeleton() {
  return (
    <div className="page">
      <div className="page-header">
        <Skeleton variant="text" width="160px" height="32px" />
      </div>
      <div className="skeleton-settings-sections">
        <Skeleton variant="card" height="160px" />
        <Skeleton variant="card" height="120px" />
        <Skeleton variant="card" height="100px" />
      </div>
    </div>
  );
}

/** Generic page skeleton for any lazy-loaded page */
export function PageSkeleton() {
  return (
    <div className="page">
      <div className="page-header">
        <Skeleton variant="text" width="180px" height="32px" />
      </div>
      <Skeleton variant="card" count={3} height="120px" />
    </div>
  );
}

export default Skeleton;
