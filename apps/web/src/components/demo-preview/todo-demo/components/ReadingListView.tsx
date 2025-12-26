import React, { useState } from 'react';
import { Plus, MoreHorizontal, Star, ExternalLink } from 'lucide-react';

interface ReadingItem {
  id: string;
  title: string;
  type: 'Article' | 'Podcast' | 'Essay Resource';
  url?: string;
  rating?: number;
  status: 'To Read' | 'Reading' | 'Completed';
  addedDate: Date;
}

interface ReadingListViewProps {
  step: 1 | 2 | 3 | 4;
}

export const ReadingListView: React.FC<ReadingListViewProps> = ({ step }) => {
  const [items, setItems] = useState<ReadingItem[]>([
    {
      id: '1',
      title: 'The Art of Productivity',
      type: 'Article',
      url: '',
      rating: 4,
      status: 'Completed',
      addedDate: new Date('2021-12-25')
    },
    {
      id: '2',
      title: 'Deep Work Principles',
      type: 'Podcast',
      rating: 5,
      status: 'To Read',
      addedDate: new Date('2021-12-20')
    },
    {
      id: '3',
      title: 'Building Better Habits',
      type: 'Essay Resource',
      status: 'Reading',
      addedDate: new Date('2021-12-18')
    }
  ]);

  const [activeTab, setActiveTab] = useState<'Articles' | 'Podcasts' | 'Essay Resources' | 'All'>('Articles');
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemType, setNewItemType] = useState<'Article' | 'Podcast' | 'Essay Resource'>('Article');
  const [newItemUrl, setNewItemUrl] = useState('');
  const [newItemStatus, setNewItemStatus] = useState<'To Read' | 'Reading' | 'Completed'>('To Read');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'All' | 'To Read' | 'Reading' | 'Completed'>('All');

  // Filter items based on active tab and status
  const filteredItems = items.filter(item => {
    // Filter by type
    const typeMatch = activeTab === 'All' || 
      (activeTab === 'Articles' && item.type === 'Article') ||
      (activeTab === 'Podcasts' && item.type === 'Podcast') ||
      (activeTab === 'Essay Resources' && item.type === 'Essay Resource');
    
    // Filter by status
    const statusMatch = statusFilter === 'All' || item.status === statusFilter;
    
    return typeMatch && statusMatch;
  });

  const handleCreateItem = () => {
    if (!newItemTitle.trim()) return;
    
    const newItem: ReadingItem = {
      id: Date.now().toString(),
      title: newItemTitle,
      type: newItemType,
      url: newItemUrl || undefined,
      status: newItemStatus,
      addedDate: new Date()
    };
    
    setItems(prev => [newItem, ...prev]);
    setNewItemTitle('');
    setNewItemUrl('');
    setNewItemStatus('To Read');
    setShowNewItemForm(false);
  };

  const handleNewItem = () => {
    setShowNewItemForm(true);
  };

  const renderRating = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'Reading': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'To Read': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Article': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Podcast': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Essay Resource': return 'bg-teal-100 text-teal-700 border-teal-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">📚</span>
        <h1 className="text-4xl font-bold text-foreground">Reading List</h1>
      </div>

      {/* Description */}
      <div className="space-y-3 mb-8">
        <p className="text-muted-foreground text-sm">
          📚 The modern day reading list includes more than just books. We have created a dashboard to help you track books, articles, podcasts, and videos. Each media type has its own view based on the Type property.
        </p>
        <p className="text-muted-foreground text-sm">
          Change your views to sort content by status, author, type, or publisher ✓
        </p>
        <p className="text-muted-foreground text-sm">
          Rate content out of 5 stars ✓
        </p>
        {/* {step >= 3 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              💡 One more thing... if you install Notion Web Clipper, you can save pages and links off the web directly to these lists.
            </p>
          </div>
        )} */}
      </div>

      {/* Media Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Media</h2>
        
        {/* View Tabs */}
        <div className="flex items-center gap-4 border-b border-border">
          <button 
            onClick={() => setActiveTab('Articles')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'Articles' 
                ? 'text-foreground border-primary' 
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Articles
          </button>
          <button 
            onClick={() => setActiveTab('Podcasts')}
            className={`flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors ${
              activeTab === 'Podcasts' 
                ? 'text-foreground border-primary font-medium' 
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            Podcasts
          </button>
          <button 
            onClick={() => setActiveTab('Essay Resources')}
            className={`flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors ${
              activeTab === 'Essay Resources' 
                ? 'text-foreground border-primary font-medium' 
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Essay Resources
          </button>
          <button 
            onClick={() => setActiveTab('All')}
            className={`text-sm border-b-2 px-3 py-2 transition-colors ${
              activeTab === 'All' 
                ? 'text-foreground border-primary font-medium' 
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            All ({items.length})
          </button>
          
          {/* Controls */}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`p-1.5 hover:bg-muted rounded transition-colors ${
                  statusFilter !== 'All' ? 'bg-primary text-primary-foreground' : ''
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                </svg>
              </button>
              {showFilterMenu && (
                <div className="absolute top-full right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg z-10 p-2">
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-muted-foreground px-2 py-1">Filter by status</h4>
                    {['All', 'To Read', 'Reading', 'Completed'].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status as 'All' | 'To Read' | 'Reading' | 'Completed');
                          setShowFilterMenu(false);
                        }}
                        className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                          statusFilter === status ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={handleNewItem}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              New
            </button>
          </div>
        </div>

        {/* New Item Form */}
        {showNewItemForm && (
          <div className="border border-border rounded-lg p-4 bg-card">
            <h3 className="text-lg font-medium text-foreground mb-4">Add New Reading Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Title</label>
                <input
                  type="text"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="Enter item title..."
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Type</label>
                  <select
                    value={newItemType}
                    onChange={(e) => setNewItemType(e.target.value as 'Article' | 'Podcast' | 'Essay Resource')}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Article">Article</option>
                    <option value="Podcast">Podcast</option>
                    <option value="Essay Resource">Essay Resource</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Status</label>
                  <select
                    value={newItemStatus}
                    onChange={(e) => setNewItemStatus(e.target.value as 'To Read' | 'Reading' | 'Completed')}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="To Read">To Read</option>
                    <option value="Reading">Reading</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">URL (optional)</label>
                <input
                  type="url"
                  value={newItemUrl}
                  onChange={(e) => setNewItemUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreateItem}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                >
                  Add Item
                </button>
                <button
                  onClick={() => {
                    setShowNewItemForm(false);
                    setNewItemTitle('');
                    setNewItemUrl('');
                    setNewItemStatus('To Read');
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center bg-muted/30 border-b border-border px-4 py-2 text-sm font-medium text-muted-foreground">
            <div className="flex-1">Title</div>
            <div className="w-32">Type</div>
            <div className="w-32">Status</div>
            <div className="w-24">Rating</div>
            <div className="w-8"></div>
          </div>

          {/* Items */}
          {filteredItems.map((item) => (
            <div key={item.id} className="flex items-center hover:bg-muted/30 border-b border-border last:border-b-0 px-4 py-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
                    >
                      {item.title}
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                  )}
                </div>
              </div>
              <div className="w-32">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(item.type)}`}>
                  {item.type}
                </span>
              </div>
              <div className="w-32">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <div className="w-24">
                {renderRating(item.rating)}
              </div>
              <div className="w-8">
                <button className="p-1 hover:bg-muted rounded transition-colors">
                  <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
