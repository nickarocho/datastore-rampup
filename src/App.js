import React, { useState, useEffect } from 'react';
import './App.css';
import { SketchPicker } from 'react-color';
import { DataStore } from '@aws-amplify/datastore';
import { Post, Comment } from './models';
import TextArea from 'antd/lib/input/TextArea';
import { Input, Button, Select } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';

const { Option } = Select;

const initialState = {
  color: '#000000',
  title: '',
  content: '',
  votes: 0,
  confirmEnabled: false,
  status: 'DRAFT',
  comment: ''
};

function App() {
  const [formState, updateFormState] = useState(initialState);
  const [posts, updatePosts] = useState([]);
  const [showPicker, updateShowPicker] = useState(false);
  const [activePost, updateActivePost] = useState({
    id: '',
    deleteEnabled: false,
    editEnabled: false,
    color: '',
    comment: '',
  });
  const [searchQuery, updateSearchQuery] = useState(['']);

  useEffect(() => {
    fetchPosts();
    const postSubscription = DataStore.observe(Post).subscribe(() => fetchPosts())
    const commentSubscription = DataStore.observe(Comment).subscribe(() => fetchPosts())
    return () => {
      postSubscription.unsubscribe();
      commentSubscription.unsubscribe();
    };
  }, [activePost]);

  function onChange(e) {
    if (e.hex) {
      updateFormState({ ...formState, color: e.hex });
    } else {
      updateFormState({ ...formState, [e.target.name]: e.target.value })
    }
  }

  function onEditChange(e) {
    if (e.hex) {
      updateActivePost({ ...activePost, color: e.hex });
    } else {
      updateActivePost({
        ...activePost,
        [e.target.name]: e.target.value,
      });
    }
  }
  
  function handleSelect(value) {
    updateFormState({ ...formState, status: value })
  }

  async function handleDelete(id) {
    if (!id) return;
    try {
      const thisPost = await DataStore.query(Post, id);
      DataStore.delete(thisPost);
      console.log(`Successfully deleted post:`, thisPost);
      fetchPosts();
    } catch (err) {
      console.error('something went wrong with handleDelete:', err);
    }
  }

  async function activateEdit(e) {
    const id = e.currentTarget.dataset.postId;
    try {
      const thisPost = await DataStore.query(Post, id);
      updateActivePost({
        ...activePost,
        ...thisPost,
        editEnabled: true,
      });
    } catch (err) {
      console.error('something went wrong with activateEdit:', err);
    }
  }

  async function handleUpdate(id) {
    if (!id) {
      console.error('No Post ID passed to handleUpdate');
    }

    try {
      const original = await DataStore.query(Post, id);
      await DataStore.save(
        Post.copyOf(original, updated => {
          Object.assign(updated, activePost);
        })
      )
    } catch (err) {
      console.error('something went wrong with handleUpdate', err)
    }

    updateActivePost({
      ...activePost,
      editEnabled: false,
      deleteEnabled: false
    });
  }

  function handleCancel(e) {
    const method = e.currentTarget.dataset.type;
    let key;
    switch (true) {
      case method === 'edit':
        key = 'editEnabled';
        break;
      case method === 'delete':
        key = 'deleteEnabled';
        break;
      default:
        key = 'defaultKey';
    }
    updateActivePost({ ...activePost, [key]: false });
  }

  function handleSearchInput(e) {
    updateSearchQuery(e.target.value);
  }
  
  function confirmDelete(e) {
    const id = e.currentTarget.dataset.postId;
    updateActivePost({ ...activePost, id, deleteEnabled: true });
  }

  async function fetchPosts() {
    try {
      const posts = await DataStore.query(Post);

      // merge Post model with Comment model
      Promise.all(
        posts.map(async post => {
          let id = post.id;
          const comments = (await DataStore.query(Comment)).filter(c => c.postID === id);
          return { ...post, comments }
        })
      ).then(posts => {
        // store the merged data in state
        // getting the newest post first... TODO: should do this in the query
        updatePosts(posts.reverse())
      });

      // IDEA: filter posts by status
      // const posts = await DataStore.query(Post, c =>
      //   c.status("eq", 'PUBLISHED')
      // );
    } catch (err) {
      console.error('something went wrong with fetchPosts:', err);
    }
  }

  function updatePostComment(e) {
    const id = e.currentTarget.dataset.postId;
    const postIndex = posts.findIndex((post) => post.id === id);
    const newPosts = [...posts];
    newPosts[postIndex]['draftedComment'] = e.target.value;
    updatePosts(newPosts)
  }

  async function handleSubmitComment(e) {
    try {
      const postID = e.currentTarget.dataset.postId;
      // just clears the form
      // updateActivePost({...activePost, draftedComment: ''})
      const postIndex = posts.findIndex((post) => post.id === postID);
      await DataStore.save(
        new Comment({
          content: posts[postIndex]['draftedComment'],
          postID
        })
      );
      // fetchPosts();
    } catch (err) {
      console.error('something went wrong with handleSubmitComment:', err);
    }
  }

  async function createPost() {
    if (!formState.title) return;
    try {
      await DataStore.save(new Post({ ...formState }))
      // just clears the form
      updateFormState(initialState);
    } catch (err) {
      console.error('something went wrong with createPost:', err);
    }
  }

  return (
    <div style={container}>
      <Input
        onChange={handleSearchInput}
        name='search'
        placeholder='Search posts...'
        value={searchQuery}
        style={input}
      />
      <h1 style={heading}>Real Time Blog</h1>
      <div style={{backgroundColor: formState.color, padding: 20}}>
        <Input
          onChange={onChange}
          name='title'
          placeholder='Post title'
          value={formState.title}
          style={input}
        />
        <TextArea
          onChange={onChange}
          name='content'
          placeholder='Post content'
          value={formState.content}
          style={input}
        />
      </div>
      <Select onChange={handleSelect} defaultValue={formState.status} name='status'>
        <Option value="DRAFT">Draft</Option>
        <Option value="PUBLISHED">Published</Option>
      </Select>
      <div>
        <Button onClick={() => updateShowPicker(!showPicker)} style={button}>Toggle Color Picker</Button>
        <p>Color: <span style={{ fontWeight: 'bold', color: formState.color }}>{formState.color}</span></p>
      </div>
      {
        showPicker && <SketchPicker color={formState.color} onChange={onChange} />
      }
      <Button type='primary' onClick={createPost}>Create Post</Button>
      {
        posts.map(post => (
          <>
            <div
              className="post"
              key={post.id}
              style={{
                ...postStyle,
                backgroundColor: (post.id === activePost.id && activePost.editEnabled) ? activePost.color : post.color
              }}
            >
              <div className="btns">
                <span className={`deleteBtn btn ${post.id === activePost.id && activePost.deleteEnabled ? '--active': ''}`}>
                  {post.id === activePost.id && activePost.deleteEnabled ?
                    <>
                      <span>You sure, yo?</span>
                      <CheckCircleOutlined data-type="delete" className="confirmBtn btn" onClick={() => handleDelete(post.id)} />
                      <CloseCircleOutlined data-type="delete" className="cancelBtn btn" onClick={handleCancel} />
                    </>
                    :
                    <DeleteOutlined data-post-id={post.id} onClick={confirmDelete} />
                  }
                </span>
                <span className={`editBtn btn ${post.id === activePost.id && activePost.editEnabled ? '--active': ''}`}>
                  {post.id === activePost.id && activePost.editEnabled ?
                    <>
                      <span>Save your changes?</span>
                      <CheckCircleOutlined data-type="edit" className="confirmBtn btn" onClick={() => handleUpdate(post.id)} />
                      <CloseCircleOutlined data-type="edit" className="cancelBtn btn" onClick={handleCancel} />
                    </>
                  :
                  <EditOutlined data-post-id={post.id} onClick={activateEdit} />
                  }
                </span>
              </div>
                {post.id === activePost.id && activePost.editEnabled ? 
                  <>
                  <div>
                      <Input
                        onChange={onEditChange}
                        name='title'
                        placeholder='Post title'
                        value={activePost.title}
                      />
                      <TextArea
                        onChange={onEditChange}
                        name='content'
                        placeholder='Post content'
                        value={activePost.content}
                      />
                    </div>
                    <Select defaultValue={activePost.status} name='status'>
                      <Option value="DRAFT">Draft</Option>
                      <Option value="PUBLISHED">Published</Option>
                    </Select>
                    <div>
                      <Button onClick={() => updateShowPicker(!showPicker)} style={button}>Toggle Color Picker</Button>
                  </div>
                  {
                    showPicker && <SketchPicker color={activePost.color} onChange={onEditChange} />
                  }
                  </>
                :
                  <div style={postBg}>
                      <h3 style={postTitle}>{post.title}</h3>
                      <p style={postTitle}>{post.content}</p>
                      <p style={postTitle}>{post.status}</p>
                  </div>
              }
            </div>
            <div style={{
              border: `30px solid ${(post.id === activePost.id && activePost.editEnabled) ? activePost.color : post.color}`,
              padding: '1em'
            }}>
              <h5>Comments ({post.comments.length})</h5>
              <ul>
              {post.comments.map(comment => (
                <li key={comment.id}>
                  {comment.content}
                </li>
              ))}
              </ul>
              <TextArea
                onChange={updatePostComment}
                onFocus={() => {updateActivePost({...activePost, id: post.id})}}
                name='comment'
                placeholder={`Express yo'self...`}
                value={post.draftedComment}
                style={input}
                data-post-id={post.id}
              />
              <Button type="primary" htmlType="submit" data-post-id={post.id} onClick={handleSubmitComment}>
                Comment
              </Button>
            </div>
          </>
        ))
      }
    </div>
  )
}

const container = { width: '100%', padding: 40, maxWidth: 900 };
const input = { marginBottom: 10 };
const button = { marginBottom: 10 };
const heading = { fontWeight: 'normal', fontSize: 40 };
const postBg = { backgroundColor: 'white' };
const postStyle = { padding: '30px', marginTop: 70 };
const postTitle = { margin: 0, padding: 9, fontSize: 20 };

export default App;
