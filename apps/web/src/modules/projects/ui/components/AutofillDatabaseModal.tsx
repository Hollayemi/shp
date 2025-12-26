"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

interface AutofillDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  onGenerate: (recordCount: number, dataDescription: string) => void;
}

export function AutofillDatabaseModal({
  isOpen,
  onClose,
  tableName,
  onGenerate,
}: AutofillDatabaseModalProps) {
  const [recordCount, setRecordCount] = useState("50");
  const [dataDescription, setDataDescription] = useState("");
  
  // Flat rate: 0.25 credits for any autofill generation
  const estimatedCredits = 0.25;
  const count = parseInt(recordCount) || 50;
  const showWarning = count >= 250;
  const exceedsLimit = count > 500;

  const handleGenerate = () => {
    const count = parseInt(recordCount) || 50;
    
    // Hard limit: reject if more than 500 records
    if (count > 500) {
      return; // Button will be disabled, but extra safety check
    }
    
    onGenerate(count, dataDescription);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/30" />
        <DialogPrimitive.Content
          className="p-0 border-none shadow-xl overflow-hidden fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{
            background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 100%)',
            width: '549px',
            maxWidth: '549px',
            borderRadius: '16px',
          }}
        >
        {/* Header - 549x79 */}
        <div 
          style={{
            height: '79px',
            padding: '16px',
            borderBottom: '1px solid #E7E9E9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Total layout for both - 481x47 with 12px gap */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Title - 206x22 */}
            <h2 
              style={{
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: '18px',
                lineHeight: '120%',
                letterSpacing: '-0.02em',
                color: '#141414'
              }}
            >
              Fill/edit database with AI
            </h2>
            {/* Subtitle - 203x21 */}
            <p 
              style={{
                fontFamily: 'Inter',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '150%',
                letterSpacing: '-0.01em',
                color: '#727272'
              }}
            >
              Configure your data generation
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-gray-100 border border-gray-200"
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X className="h-4 w-4 text-[#727272]" />
          </button>
        </div>

        {/* Container - 517x428 */}
        <div 
          style={{
            width: '517px',
            margin: '24px auto 16px',
            borderRadius: '16px',
            padding: '8px',
            backgroundColor: '#F3F3EE',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          {/* Container Header - 501x33 */}
          <div 
            style={{
              width: '501px',
              height: '33px',
              paddingTop: '2px',
              paddingRight: '8px',
              paddingBottom: '2px',
              paddingLeft: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {/* Database Information - 142x21 */}
            <h3 
              style={{
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '150%',
                letterSpacing: '-0.01em',
                textAlign: 'center',
                color: '#141414'
              }}
            >
              Database Information
            </h3>
          </div>

          {/* Campaign list container - 501x373 */}
          <div 
            style={{
              width: '501px',
              borderRadius: '12px',
              paddingTop: '16px',
              paddingRight: '24px',
              paddingBottom: '16px',
              paddingLeft: '16px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0px 1px 1.5px 0px #2C363506',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}
          >
            {/* AI credit box - 461x113 */}
            <div 
              style={{
                width: '461px',
                height: '113px',
                borderRadius: '12px',
                border: '1px solid #B5C4EC',
                padding: '12px',
                backgroundColor: '#F5F6FF',
                boxShadow: '0px 0px 0px 2px #FFFFFF inset',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {/* Dynamic Credits - 437x29 */}
              <div 
                style={{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '24px',
                  lineHeight: '100%',
                  letterSpacing: '-0.01em',
                  textAlign: 'center',
                  color: '#141414'
                }}
              >
                {estimatedCredits.toFixed(2)}
              </div>
              {/* Description - 437x54 */}
              <div 
                style={{
                  fontFamily: 'Inter',
                  fontWeight: 400,
                  fontSize: '12px',
                  lineHeight: '150%',
                  letterSpacing: '-0.01em',
                  textAlign: 'center',
                  color: '#727272',
                  maxWidth: '437px'
                }}
              >
                AI Credits Required for this generation.
              </div>
            </div>

            {/* Text input 1 - 461x73 */}
            <div style={{ width: '461px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Label - 215x21 */}
              <label 
                style={{
                  fontFamily: 'Inter',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '150%',
                  letterSpacing: '-0.01em',
                  color: '#141414'
                }}
              >
                How many records do you want?
              </label>
              {/* Input - 437x17 */}
              <input
                type="number"
                value={recordCount}
                onChange={(e) => setRecordCount(e.target.value)}
                placeholder="50"
                min="1"
                max="500"
                className="placeholder:text-[#898F8F]"
                style={{
                  width: '453px',
                  height: '36px',
                  padding: '8px',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0px 1px 1.5px 0px #2C363506',
                  border: exceedsLimit ? '1px solid #EF4444' : '1px solid #F2F2F2',
                  borderRadius: '8px',
                  fontFamily: 'Inter',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '100%',
                  letterSpacing: '-0.01em',
                  color: '#141414'
                }}
              />
              {exceedsLimit && (
                <p 
                  style={{
                    fontFamily: 'Inter',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '150%',
                    letterSpacing: '-0.01em',
                    color: '#EF4444'
                  }}
                >
                  Maximum 500 records allowed
                </p>
              )}
              {showWarning && !exceedsLimit && (
                <p 
                  style={{
                    fontFamily: 'Inter',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '150%',
                    letterSpacing: '-0.01em',
                    color: '#F59E0B'
                  }}
                >
                  This may use more credits and may take longer, since you&apos;ve got more records
                </p>
              )}
            </div>

            {/* Text input 2 - 461x123 */}
            <div style={{ width: '461px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Label - 124x21 */}
              <label 
                style={{
                  fontFamily: 'Inter',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '150%',
                  letterSpacing: '-0.01em',
                  color: '#141414'
                }}
              >
                What kind of data?
              </label>
              {/* Textarea - 437x40 */}
              <textarea
                value={dataDescription}
                onChange={(e) => setDataDescription(e.target.value)}
                placeholder="E.g., 'top 100 cities in the US', 'mock user profiles', '10 biggest lakes in the world', 'Fortune 500'"
                className="placeholder:text-[#898F8F]"
                style={{
                  width: '461px',
                  height: '94px',
                  borderRadius: '8px',
                  border: '1px solid #F2F2F2',
                  padding: '8px',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0px 1px 1.5px 0px #2C363506',
                  fontFamily: 'Inter',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '140%',
                  letterSpacing: '-0.01em',
                  color: '#141414',
                  resize: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center px-6 pb-6 pt-6" style={{ gap: '12px', justifyContent: 'space-between' }}>
          {/* Cancel button - 254.5x36 */}
          <button
            onClick={onClose}
            style={{
              width: '254.5px',
              height: '36px',
              borderRadius: '6px',
              paddingTop: '8px',
              paddingRight: '9px',
              paddingBottom: '8px',
              paddingLeft: '9px',
              gap: '8px',
              fontFamily: 'Inter',
              fontWeight: 500,
              fontSize: '14px',
              lineHeight: '20px',
              letterSpacing: '0%',
              textAlign: 'center',
              color: '#141414',
              backgroundColor: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0px 2px 5px 0px #676E7614',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            className="hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {/* Generate Records button - 254.5x36 */}
          <button
            onClick={handleGenerate}
            disabled={exceedsLimit}
            style={{
              width: '254.5px',
              height: '36px',
              borderRadius: '6px',
              paddingTop: '4px',
              paddingRight: '9px',
              paddingBottom: '4px',
              paddingLeft: '9px',
              gap: '8px',
              fontFamily: 'Inter',
              fontWeight: 500,
              fontSize: '14px',
              lineHeight: '20px',
              letterSpacing: '0%',
              textAlign: 'center',
              color: '#FFFFFF',
              backgroundColor: exceedsLimit ? '#9CA3AF' : '#1E9A80',
              border: 'none',
              cursor: exceedsLimit ? 'not-allowed' : 'pointer',
              boxShadow: exceedsLimit ? 'none' : '0px 2px 4px rgba(30, 154, 128, 0.2), 0px 1px 2px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: exceedsLimit ? 0.5 : 1
            }}
            className={exceedsLimit ? '' : 'hover:bg-[#17816B] transition-colors'}
          >
            Generate Records
          </button>
        </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
