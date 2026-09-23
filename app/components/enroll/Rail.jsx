export default function Rail({ labels, posInPath }) {
  return (
    <>
      <div className="rail">
        {labels.map((_, i) => (
          <div key={i} className={"rail-seg" + (i < posInPath ? " done" : i === posInPath ? " active" : "")} />
        ))}
      </div>
      <div className="rail-labels">
        {labels.map((label, i) => (
          <span key={label} className={i === posInPath ? "current" : ""}>{label}</span>
        ))}
      </div>
    </>
  );
}
