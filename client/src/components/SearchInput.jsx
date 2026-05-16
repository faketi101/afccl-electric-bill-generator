export default function SearchInput({ value, onChange, placeholder = "Search..." }) {
  return (
    <input 
      type="text" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder}
      style={{ 
        padding: '0.6rem 1rem', 
        border: '1px solid #cbd5e0', 
        borderRadius: '20px', 
        fontSize: '0.9rem', 
        minWidth: '250px',
        outline: 'none'
      }}
    />
  );
}
