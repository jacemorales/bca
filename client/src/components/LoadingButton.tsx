import React from 'react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean;
  loadingText?: string;
}

const LoadingSpinner = () => (
  <div className="loading-spinner-small" />
);

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  loadingText = 'Loading...',
  children,
  ...props
}) => {
  return (
    <button {...props} disabled={isLoading || props.disabled}>
      {isLoading ? (
        <>
          <LoadingSpinner />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
