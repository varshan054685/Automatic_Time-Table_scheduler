export function ContentCard({ title, description, header, children, className }) {
  return (
    <div
      className={
        "bg-white rounded-2xl border border-slate-100 overflow-hidden " +
        (className || "")
      }
      style={{ boxShadow: "0 2px 16px -4px rgba(0,0,0,0.06)" }}
    >
      {header ? (
        header
      ) : title ? (
        <div className="px-6 py-5 border-b border-slate-50">
          <h3 className="text-[15px] font-display font-black text-slate-900 tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-slate-500 font-medium mt-0.5">{description}</p>
          )}
        </div>
      ) : null}
      <div className="p-6">{children}</div>
    </div>
  );
}
